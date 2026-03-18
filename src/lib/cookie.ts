const COOKIE_KEY = 'word_master_user_id';

export function getUserCookie(): string {
  let cookie = localStorage.getItem(COOKIE_KEY);
  if (!cookie) {
    cookie = crypto.randomUUID();
    localStorage.setItem(COOKIE_KEY, cookie);
  }
  return cookie;
}
