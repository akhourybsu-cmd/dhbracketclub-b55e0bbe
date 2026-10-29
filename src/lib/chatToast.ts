import { toast } from "sonner";

// Feedback stays away from the composer so an error never blocks Retry/Send.
export const chatToast = {
  error: (
    message: Parameters<typeof toast.error>[0],
    options?: Parameters<typeof toast.error>[1],
  ) =>
    toast.error(message, {
      duration: 4000,
      closeButton: true,
      ...options,
      position: "top-center",
    }),
  success: (
    message: Parameters<typeof toast.success>[0],
    options?: Parameters<typeof toast.success>[1],
  ) =>
    toast.success(message, {
      duration: 3000,
      closeButton: true,
      ...options,
      position: "top-center",
    }),
};
