export class AppError extends Error {
  public readonly code: string;
  public readonly userMessageKey: string;
  public readonly statusCode: number;

  constructor(code: string, userMessageKey: string, message?: string, statusCode = 500) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.userMessageKey = userMessageKey;
    this.statusCode = statusCode;
  }
}
