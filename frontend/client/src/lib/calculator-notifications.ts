/**
 * Calculator-specific notification utilities
 * Uses browser notifications and visual feedback
 */

export type NotificationType = "success" | "error" | "warning" | "info";

interface NotificationOptions {
  title: string;
  message: string;
  type: NotificationType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Show a notification to the user
 * This is a simple implementation - can be replaced with a toast library
 */
export function showNotification(options: NotificationOptions): void {
  const { title, message, type, duration = 5000, action } = options;

  // Create notification element
  const notification = document.createElement("div");
  notification.className = `calculator-notification calculator-notification-${type}`;
  notification.innerHTML = `
    <div class="calculator-notification-content">
      <div class="calculator-notification-icon">
        ${getIconForType(type)}
      </div>
      <div class="calculator-notification-text">
        <div class="calculator-notification-title">${title}</div>
        <div class="calculator-notification-message">${message}</div>
      </div>
      ${
        action
          ? `<button class="calculator-notification-action">${action.label}</button>`
          : ""
      }
      <button class="calculator-notification-close">×</button>
    </div>
  `;

  // Add styles if not already added
  if (!document.getElementById("calculator-notification-styles")) {
    const styles = document.createElement("style");
    styles.id = "calculator-notification-styles";
    styles.textContent = getNotificationStyles();
    document.head.appendChild(styles);
  }

  // Add to DOM
  let container = document.getElementById("calculator-notifications");
  if (!container) {
    container = document.createElement("div");
    container.id = "calculator-notifications";
    document.body.appendChild(container);
  }
  container.appendChild(notification);

  // Handle action click
  if (action) {
    const actionButton = notification.querySelector(".calculator-notification-action");
    actionButton?.addEventListener("click", () => {
      action.onClick();
      removeNotification(notification);
    });
  }

  // Handle close click
  const closeButton = notification.querySelector(".calculator-notification-close");
  closeButton?.addEventListener("click", () => {
    removeNotification(notification);
  });

  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(() => {
      removeNotification(notification);
    }, duration);
  }

  // Animate in
  requestAnimationFrame(() => {
    notification.classList.add("calculator-notification-show");
  });
}

function removeNotification(notification: HTMLElement): void {
  notification.classList.remove("calculator-notification-show");
  notification.classList.add("calculator-notification-hide");
  setTimeout(() => {
    notification.remove();
  }, 300);
}

function getIconForType(type: NotificationType): string {
  const icons = {
    success: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M16.667 5L7.5 14.167 3.333 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    error: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 6v4m0 4h.01M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    warning: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 6v4m0 4h.01M8.257 3.099l-7.5 13A2 2 0 002.5 19h15a2 2 0 001.743-2.901l-7.5-13a2 2 0 00-3.486 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    info: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 11v5m0-9h.01M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  };
  return icons[type];
}

function getNotificationStyles(): string {
  return `
    #calculator-notifications {
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 400px;
    }

    .calculator-notification {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 16px;
      opacity: 0;
      transform: translateX(400px);
      transition: all 0.3s ease-out;
    }

    .calculator-notification-show {
      opacity: 1;
      transform: translateX(0);
    }

    .calculator-notification-hide {
      opacity: 0;
      transform: translateX(400px);
    }

    .calculator-notification-content {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .calculator-notification-icon {
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-center;
    }

    .calculator-notification-success .calculator-notification-icon {
      background: #10B981;
      color: white;
    }

    .calculator-notification-error .calculator-notification-icon {
      background: #EF4444;
      color: white;
    }

    .calculator-notification-warning .calculator-notification-icon {
      background: #F59E0B;
      color: white;
    }

    .calculator-notification-info .calculator-notification-icon {
      background: #3B82F6;
      color: white;
    }

    .calculator-notification-text {
      flex: 1;
    }

    .calculator-notification-title {
      font-weight: 600;
      font-size: 14px;
      color: #0F1419;
      margin-bottom: 4px;
    }

    .calculator-notification-message {
      font-size: 13px;
      color: #6B7280;
      line-height: 1.4;
    }

    .calculator-notification-action {
      background: #00B4D8;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      margin-left: 8px;
    }

    .calculator-notification-action:hover {
      background: #0099B4;
    }

    .calculator-notification-close {
      background: none;
      border: none;
      color: #9CA3AF;
      font-size: 24px;
      line-height: 1;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      flex-shrink: 0;
    }

    .calculator-notification-close:hover {
      color: #6B7280;
    }

    @media (max-width: 640px) {
      #calculator-notifications {
        left: 20px;
        right: 20px;
        max-width: none;
      }

      .calculator-notification {
        transform: translateY(-100px);
      }

      .calculator-notification-show {
        transform: translateY(0);
      }

      .calculator-notification-hide {
        transform: translateY(-100px);
      }
    }
  `;
}

// Convenience functions
export function showSuccess(title: string, message: string): void {
  showNotification({ title, message, type: "success" });
}

export function showError(title: string, message: string, action?: NotificationOptions["action"]): void {
  showNotification({ title, message, type: "error", duration: 0, action });
}

export function showWarning(title: string, message: string): void {
  showNotification({ title, message, type: "warning" });
}

export function showInfo(title: string, message: string): void {
  showNotification({ title, message, type: "info" });
}
