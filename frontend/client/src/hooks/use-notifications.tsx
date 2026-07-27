import { useEffect, useState } from "react";

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    // Check if browser supports notifications
    if ("Notification" in window) {
      setPermission(Notification.permission);

      // Re-check permission when the user is likely to have changed it in
      // browser settings (returning focus to the tab / making it visible).
      // This replaces a wasteful 1s polling timer.
      const checkPermission = () => {
        setPermission(Notification.permission);
      };

      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          checkPermission();
        }
      };

      window.addEventListener("focus", checkPermission);
      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        window.removeEventListener("focus", checkPermission);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    if (!("Notification" in window)) {
      return false;
    }

    if (Notification.permission === "granted") {
      return true;
    }

    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      setPermission(permission);
      return permission === "granted";
    }

    return false;
  };

  const showNotification = (title: string, options?: NotificationOptions) => {
    if (!("Notification" in window)) {
      return;
    }

    if (Notification.permission === "granted") {
      try {
        const notification = new Notification(title, {
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          requireInteraction: false,
          ...options,
        });
        
        // Auto-close after 5 seconds
        setTimeout(() => {
          notification.close();
        }, 5000);
        
        return notification;
      } catch (err) {
      }
    } else {
    }
  };

  return {
    permission,
    requestPermission,
    showNotification,
    isSupported: "Notification" in window,
  };
}

