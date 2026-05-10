/**
 * LINE Webhook Handler (Router)
 *
 * Entry point for LINE webhook events.
 * All handler logic is split into dedicated modules:
 *   - StateHandler.js    — conversation state management
 *   - DateInputHelper.js — date parsing, calendar/time UI
 *   - ReservationHandler.js — new reservation flow
 *   - ChangeHandler.js   — reservation change flow
 *   - CancelHandler.js   — reservation cancel flow
 *   - MessageRouter.js   — event routing, idle state, commands, pagination utilities
 *
 * GAS global scope: all functions from the above files are automatically available.
 */
