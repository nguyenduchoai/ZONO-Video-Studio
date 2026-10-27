# coding: utf-8
"""
Face detection for LivePortrait using Google MediaPipe FaceLandmarker (Apache-2.0) instead of InsightFace
(whose pretrained models are for non-commercial research only) — so ZONO can use LivePortrait commercially.

LivePortrait only needs, per face: a bbox (to pick the face by `direction`) and a rough 106-point layout that
`crop.parse_pt2_from_pt106` / `parse_rect_from_landmark` understand: eye centres (33,35,39,40 / 87,89,93,94),
lip centre (52, 61) and the overall extent (jaw + brows). Its own landmark model (MIT, landmark.onnx) then
refines to 203 points. We map MediaPipe's 478-point mesh onto exactly those roles.
Installed by scripts/install-video-ai.mjs (copied into LivePortrait/src/utils/).
"""
import os.path as osp
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

# MediaPipe face-mesh indices
_EYE_A = [33, 133, 159, 145]          # one eye: corners + upper/lower lid → 106-layout 33, 35, 40, 39
_EYE_B = [362, 263, 386, 374]         # other eye                          → 87, 89, 94, 93
_LIP_UP, _LIP_LOW = 13, 14            # inner lip centres                  → 52, 61
_JAW = [234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454]
_BROWS = [70, 63, 105, 66, 107, 336, 296, 334, 293, 300]
_EXTRA = [1, 4, 61, 291, 168, 6]       # nose bridge/tip, mouth corners
_SEMANTIC = {33: _EYE_A[0], 35: _EYE_A[1], 40: _EYE_A[2], 39: _EYE_A[3],
             87: _EYE_B[0], 89: _EYE_B[1], 94: _EYE_B[2], 93: _EYE_B[3],
             52: _LIP_UP, 61: _LIP_LOW}


class _Face(dict):
    """Same access style as insightface's Face: attributes and keys."""
    def __getattr__(self, k):
        return self.get(k)


def _to_106(pts: np.ndarray) -> np.ndarray:
    fill = _JAW + _BROWS + _EXTRA
    out = np.zeros((106, 2), dtype=np.float32)
    j = 0
    for i in range(106):
        if i in _SEMANTIC:
            out[i] = pts[_SEMANTIC[i]]
        else:
            out[i] = pts[fill[j % len(fill)]]
            j += 1
    return out


def _sort_by_direction(faces, direction='large-small', face_center=None):
    if len(faces) <= 1:
        return faces
    if direction == 'left-right':
        return sorted(faces, key=lambda f: f['bbox'][0])
    if direction == 'right-left':
        return sorted(faces, key=lambda f: f['bbox'][0], reverse=True)
    if direction == 'top-bottom':
        return sorted(faces, key=lambda f: f['bbox'][1])
    if direction == 'bottom-top':
        return sorted(faces, key=lambda f: f['bbox'][1], reverse=True)
    if direction == 'small-large':
        return sorted(faces, key=lambda f: (f['bbox'][2] - f['bbox'][0]) * (f['bbox'][3] - f['bbox'][1]))
    if direction == 'large-small':
        return sorted(faces, key=lambda f: (f['bbox'][2] - f['bbox'][0]) * (f['bbox'][3] - f['bbox'][1]), reverse=True)
    if direction == 'distance-from-retarget-face' and face_center is not None:
        return sorted(faces, key=lambda f: (((f['bbox'][2] + f['bbox'][0]) / 2 - face_center[0]) ** 2 + ((f['bbox'][3] + f['bbox'][1]) / 2 - face_center[1]) ** 2) ** 0.5)
    return faces


class FaceAnalysisMediaPipe:
    def __init__(self, model_path=None, max_faces=5, det_thresh=0.5, **_):
        model_path = model_path or osp.join(osp.dirname(osp.realpath(__file__)), "../../pretrained_weights/mediapipe/face_landmarker.task")
        self.max_faces = max_faces
        self.det_thresh = det_thresh
        self._model_path = osp.abspath(model_path)
        self._lm = None

    def prepare(self, ctx_id=0, det_size=(512, 512), det_thresh=None, **_):
        if det_thresh is not None:
            self.det_thresh = float(det_thresh)
        opts = vision.FaceLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=self._model_path),
            running_mode=vision.RunningMode.IMAGE,
            num_faces=self.max_faces,
            min_face_detection_confidence=self.det_thresh,
            min_face_presence_confidence=self.det_thresh,
        )
        self._lm = vision.FaceLandmarker.create_from_options(opts)

    def get(self, img_bgr, **kwargs):
        if self._lm is None:
            self.prepare()
        h, w = img_bgr.shape[:2]
        rgb = np.ascontiguousarray(img_bgr[..., ::-1])
        res = self._lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
        faces = []
        for lms in (res.face_landmarks or [])[: kwargs.get('max_face_num', self.max_faces) or self.max_faces]:
            pts = np.array([[p.x * w, p.y * h] for p in lms], dtype=np.float32)
            x0, y0 = pts.min(axis=0)
            x1, y1 = pts.max(axis=0)
            faces.append(_Face(bbox=np.array([x0, y0, x1, y1], dtype=np.float32), det_score=1.0, kps=None, landmark_2d_106=_to_106(pts)))
        return _sort_by_direction(faces, kwargs.get('direction', 'large-small'), kwargs.get('face_center'))

    def warmup(self):
        self.get(np.zeros((512, 512, 3), dtype=np.uint8))
