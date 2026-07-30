export interface LoginResponseDTO {
  token: string;
  roles: string[];
  email: string;
  password: string;
}
