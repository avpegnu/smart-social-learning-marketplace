export interface JwtPayload {
  sub: string; // userId
  role: string;
  iat?: number;
  exp?: number;
}
