import type { ChangeEvent, FormEvent } from 'react';

export interface FormErrors {
  username?: string | null;
  password?: string | null;
}

export interface ApiError {
  error?: string;
  message?: string;
}

export interface ForceChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface LoginViewProps {
  username: string;
  password: string;
  loading: boolean;
  error: string;
  formErrors: FormErrors;
  usernameFocused: boolean;
  passwordFocused: boolean;
  showForceChangePassword: boolean;
  newPassword: string;
  confirmPassword: string;
  changePasswordLoading: boolean;
  changePasswordError: string;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  handleUsernameChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleUsernameFocus: () => void;
  handleUsernameBlur: () => void;
  handlePasswordChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handlePasswordFocus: () => void;
  handlePasswordBlur: () => void;
  handleChangePassword: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  handleCloseModal: () => void;
  setNewPassword: (value: string) => void;
  setConfirmPassword: (value: string) => void;
}
