/**
 * Focus Mode, Pomodoro, Reminders and Reporting
 * Phase 6: Focus mode, timer, reminders
 */

const FocusTools = (() => {
  let timerInterval = null;
  let timeLeft = 25 * 60;
  let isFocusing = false;

  class PomodoroTimer {
    static start(durationMinutes = 25) {
      timeLeft = durationMinutes * 60;
      isFocusing = true;
      timerInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
          FocusTools.stop();
          if (window.Notification && Notification.permission === 'granted') {
            new Notification('CSIR Tracker', { body: 'Pomodoro complete! Take a break.' });
          }
        }
      }, 1000);
    }
    static stop() { isFocusing = false; clearInterval(timerInterval); timerInterval = null; }
    static getTimeLeft() { return { minutes: Math.floor(timeLeft / 60), seconds: timeLeft % 60, isFocusing }; }
  }

  class FocusMode {
    static enable() {
      document.body.classList.add('focus-mode');
      document.querySelector('.theme-switcher')?.classList.add('hidden');
    }
    static disable() {
      document.body.classList.remove('focus-mode');
      document.querySelector('.theme-switcher')?.classList.remove('hidden');
    }
  }

  return { PomodoroTimer, FocusMode };
})();
if (typeof window !== 'undefined') window.FocusToolsModule = FocusTools;
