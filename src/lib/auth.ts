export const getAccessToken = async (): Promise<string | null> => {
  return localStorage.getItem('google_access_token');
};

export const logout = () => {
  localStorage.removeItem('google_access_token');
  window.location.reload();
};
