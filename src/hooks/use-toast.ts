
import { toast as sonnerToast } from "sonner";
import { useState, useEffect } from "react";

// Define our own ToastOptions type based on what sonner accepts
// instead of trying to import it directly
type ToastOptions = {
  id?: string;
  duration?: number;
  promise?: Promise<any>;
  closeButton?: boolean;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top-center" | "bottom-center";
  important?: boolean;
  loading?: boolean;
  success?: string;
  error?: string;
  createdAt?: number;
};

type ToastProps = ToastOptions & {
  id: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "default" | "destructive";
};

export function useToast() {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const toast = ({ 
    title, 
    description, 
    action, 
    variant = "default", 
    ...props 
  }: {
    title?: string;
    description?: string;
    variant?: "default" | "destructive";
    action?: React.ReactNode;
  } & ToastOptions) => {
    const id = crypto.randomUUID();
    
    // Add toast to state
    setToasts((currentToasts) => [
      ...currentToasts,
      { id, title, description, action, variant, ...props },
    ]);
    
    // Use sonner for the actual UI
    if (title && description) {
      sonnerToast(title, {
        description,
        ...props
      });
    } else {
      sonnerToast(title || description || "", props);
    }

    return {
      id,
      update: ({ title, description }: { title: string; description: string }) => {
        setToasts((currentToasts) =>
          currentToasts.map((t) =>
            t.id === id ? { ...t, title, description } : t
          )
        );
      },
      dismiss: () => {
        setToasts((currentToasts) =>
          currentToasts.filter((t) => t.id !== id)
        );
      },
    };
  };

  // Clean up toasts after they expire
  useEffect(() => {
    const timer = setTimeout(() => {
      setToasts((currentToasts) => {
        // Remove toasts older than 5 seconds (default duration)
        const now = new Date().getTime();
        return currentToasts.filter((t) => {
          const createdAt = t.createdAt || now;
          const duration = t.duration || 5000;
          return now - createdAt < duration;
        });
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [toasts]);

  return {
    toast,
    toasts,
    dismiss: (toastId?: string) => {
      if (toastId) {
        setToasts((currentToasts) =>
          currentToasts.filter((t) => t.id !== toastId)
        );
      } else {
        setToasts([]);
      }
    },
  };
}

// Also export the toast function directly
export const toast = ({
  title,
  description,
  variant = "default",
  ...props
}: {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
} & ToastOptions) => {
  if (title && description) {
    return sonnerToast(title, {
      description,
      ...props
    });
  }
  return sonnerToast(title || description || "", props);
};
