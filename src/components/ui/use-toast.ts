import { toast as sonnerToast } from "sonner";

type ToastProps = {
  title?: string;
  description?: string;
  duration?: number;
  variant?: "default" | "destructive" | "success";
  action?: React.ReactNode;
  // Add other properties you might need
};

// Define a custom useToast hook that returns the toast function
const useToast = () => {
  return {
    toast: (props: ToastProps) => {
      // Map the variant to the appropriate sonner function
      if (props.variant === "destructive") {
        return sonnerToast.error(props.title, {
          description: props.description,
          duration: props.duration,
        });
      } else if (props.variant === "success") {
        return sonnerToast.success(props.title, {
          description: props.description,
          duration: props.duration,
        });
      } else {
        // Default case
        return sonnerToast(props.title, {
          description: props.description,
          duration: props.duration,
        });
      }
    }
  };
};

// For direct usage when you don't want to use the hook
const toast = (props: ToastProps) => {
  if (props.variant === "destructive") {
    return sonnerToast.error(props.title, {
      description: props.description,
      duration: props.duration,
    });
  } else if (props.variant === "success") {
    return sonnerToast.success(props.title, {
      description: props.description,
      duration: props.duration,
    });
  } else {
    return sonnerToast(props.title, {
      description: props.description,
      duration: props.duration,
    });
  }
};

export { useToast, toast };
export type { ToastProps };