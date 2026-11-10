import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;

export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, BCRYPT_ROUNDS);

export const verifyPassword = (
  password: string,
  hash: string,
): Promise<boolean> => bcrypt.compare(password, hash);

// Compared against when the email is unknown, so that a missing user takes
// as long to reject as a wrong password and the timing reveals nothing.
export const UNKNOWN_USER_HASH = bcrypt.hashSync(
  'password-of-a-user-that-does-not-exist',
  BCRYPT_ROUNDS,
);
