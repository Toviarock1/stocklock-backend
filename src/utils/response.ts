interface ResponseProps<T = any> {
  message: string;
  status: number;
  success: boolean;
  data?: T;
}

export default function createResponse<T>({
  message = "Operation successful",
  status,
  success,
  data,
}: ResponseProps<T>) {
  return { message, status, success, data: data ?? {} };
}
