import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// The authentication guard is global: this marks a route that works without a token.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
