import { toast } from "sonner";

export const showSuccessToastMessage = (message: string) =>
  toast.success(message);

export const showErrorToastMessage = (message: string) => toast.error(message);
