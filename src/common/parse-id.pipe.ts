import { HttpStatus, ParseUUIDPipe } from '@nestjs/common';

// A malformed id cannot belong to any record, so the routes answer 404 for it, not 400.
export const parseIdPipe = new ParseUUIDPipe({
  errorHttpStatusCode: HttpStatus.NOT_FOUND,
});
