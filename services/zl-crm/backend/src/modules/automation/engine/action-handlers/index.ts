// Phase G — action handler barrel.
//
// Engine bootstrap imports from here. Adding a new action type:
//   1. Create handler file in this directory
//   2. Export from this barrel
//   3. Register in ../index.ts startAutomationEngine()
//   4. Add the type to BlockActionType enum in ../../blocks/types.ts

export { updateStatusHandler } from './update-status.js';
export { requestFriendHandler } from './request-friend.js';
export { sendMessageHandler } from './send-message.js';
