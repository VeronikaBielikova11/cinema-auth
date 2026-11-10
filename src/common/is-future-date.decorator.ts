import { registerDecorator, ValidationArguments } from 'class-validator';

export function IsFutureDate() {
  return (target: object, propertyName: string) => {
    registerDecorator({
      name: 'isFutureDate',
      target: target.constructor,
      propertyName,
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && Date.parse(value) > Date.now(),
        defaultMessage: (args: ValidationArguments) =>
          `${args.property} must be a moment in the future`,
      },
    });
  };
}
