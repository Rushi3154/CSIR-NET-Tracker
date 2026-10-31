/**
 * Undo System for CSIR-NET Chemistry Tracker
 * Phase 1: Interface Refinement - Undo functionality
 *
 * Provides comprehensive undo capabilities for all topic operations.
 * Works with both desktop (Electron) and browser (localStorage) environments.
 */

const UndoSystem = (() => {
  const MAX_UNDO_HISTORY = 20;
  const UNDO_TIMEOUT = 5000; // 5 seconds to show undo notification

  class UndoManager {
    constructor() {
      this.history = [];
      this.timeoutId = null;
      this.onUndoCallback = null;
    }

    /**
     * Push a new action to the undo stack
     * @param {Object} action - Action to track for undo
     */
    pushAction(action) {
      if (!action) return;
      this.history.push(action);

      // Limit history size
      if (this.history.length > MAX_UNDO_HISTORY) {
        this.history.shift();
      }

      this._showUndoNotification(action);
    }

    /**
     * Check if undo is available
     * @returns {boolean}
     */
    canUndo() {
      return this.history.length > 0;
    }

    /**
     * Perform undo operation
     * @returns {Object|null} The undone action or null if nothing to undo
     */
    undo() {
      if (!this.canUndo()) return null;

      const actionToUndo = this.history.pop();

      if (this.onUndoCallback) {
        this.onUndoCallback(actionToUndo);
      }

      this._hideUndoNotification();
      return actionToUndo;
    }

    /**
     * Clear all undo history
     */
    clear() {
      this.history = [];
      this._hideUndoNotification();
    }

    /**
     * Set callback for when undo is performed
     * @param {Function} callback
     */
    onUndo(callback) {
      this.onUndoCallback = callback;
    }

    /**
     * Show undo notification
     * @param {Object} action
     */
    _showUndoNotification(action) {
      if (typeof document === 'undefined') return;
      this._hideUndoNotification();

      if (!action || !action.description) return;

      const notification = document.createElement('div');
      notification.id = 'undo-notification';
      notification.className = 'undo-notification';
      notification.setAttribute('role', 'status');
      notification.setAttribute('aria-live', 'polite');
      notification.innerHTML = `
        <span class="undo-message">${action.description}</span>
        <button class="undo-btn" id="undo-btn" type="button" aria-label="Undo action">Undo</button>
      `;

      // Add styles
      const style = document.createElement('style');
      style.textContent = `
        .undo-notification {
          position: fixed;
          bottom: max(24px, calc(16px + env(safe-area-inset-bottom)));
          left: 50%;
          transform: translateX(-50%);
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 12px 18px;
          box-shadow: var(--shadow-lg);
          display: flex;
          align-items: center;
          gap: 14px;
          z-index: 1000;
          animation: slideUp 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
          backdrop-filter: blur(24px) saturate(145%);
          -webkit-backdrop-filter: blur(24px) saturate(145%);
          max-width: min(540px, calc(100vw - 32px));
        }
        .undo-message {
          font-size: 13.5px;
          font-weight: 500;
          color: var(--text);
          line-height: 1.4;
        }
        .undo-btn {
          background: var(--accent);
          color: #ffffff;
          border: none;
          padding: 6px 14px;
          border-radius: 999px;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
          transition: background-color 0.15s ease, transform 0.15s ease;
          flex-shrink: 0;
        }
        .undo-btn:hover {
          background: var(--accent-hover);
          transform: scale(1.04);
        }
        .undo-btn:active {
          transform: scale(0.96);
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `;

      if (!document.getElementById('undo-notification-styles')) {
        style.id = 'undo-notification-styles';
        document.head.appendChild(style);
      }

      document.body.appendChild(notification);

      // Auto-hide after timeout
      this.timeoutId = setTimeout(() => {
        this._hideUndoNotification();
      }, UNDO_TIMEOUT);

      // Add undo button listener
      document.getElementById('undo-btn').addEventListener('click', () => {
        this.undo();
      });
    }

    /**
     * Hide undo notification
     */
    _hideUndoNotification() {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }

      if (typeof document === 'undefined') return;
      const notification = document.getElementById('undo-notification');
      if (notification) {
        notification.remove();
      }
    }
  }

  return { UndoManager, MAX_UNDO_HISTORY };
})();

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UndoSystem;
} else if (typeof window !== 'undefined') {
  window.UndoSystem = UndoSystem;
}