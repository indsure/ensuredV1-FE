import { useEffect, useState } from "react";

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    // Check if browser supports notifications
    if ("Notification" in window) {
      setPermission(Notification.permission);
      
      // Listen for permission changes
      const checkPermission = () => {
        setPermission(Notification.permission);
      };
      
      // Check permission periodically (in case user changes it in browser settings)
      const interval = setInterval(checkPermission, 1000);
      
      return () => clearInterval(interval);
    }
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    if (!("Notification" in window)) {
      console.log("This browser does not support notifications");
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
      console.warn("Browser does not support notifications");
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
        console.error("Failed to create notification:", err);
      }
    } else {
      console.warn("Notification permission not granted. Current permission:", Notification.permission);
    }
  };

  return {
    permission,
    requestPermission,
    showNotification,
    isSupported: "Notification" in window,
  };
}

