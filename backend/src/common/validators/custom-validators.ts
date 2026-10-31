import { registerDecorator, ValidationOptions } from 'class-validator';

/** 空值判定：可选字段允许留空（undefined / null / 空串） */
function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

/** 是否为 http/https 绝对地址（拒绝 javascript:、data:、协议相对 // 等） */
export function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * URL 字段校验：允许留空，或必须是 http/https 绝对地址。
 * 用于头像/封面/配图/图标等资源地址，防止写入 javascript:、data: 等危险协议。
 */
export function IsHttpUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isHttpUrl',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (isBlank(value)) return true;
          if (typeof value !== 'string') return false;
          return isHttpUrl(value);
        },
        defaultMessage() {
          return '$property 必须是 http/https 开头的合法链接';
        },
      },
    });
  };
}

/**
 * 跳转值校验（Banner linkValue）：允许留空、站内相对路径（/x）、
 * http/https 绝对地址或纯数字 ID；拒绝 javascript:/data: 及协议相对 //evil.com。
 */
export function IsSafeLink(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isSafeLink',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (isBlank(value)) return true;
          if (typeof value !== 'string') return false;
          const v = value.trim();
          if (/^\d+$/.test(v)) return true; // 书/书单 ID
          if (v.startsWith('//')) return false; // 协议相对地址会跳出站外
          if (v.startsWith('/')) return true; // 站内相对路径
          return isHttpUrl(v); // 绝对 http/https
        },
        defaultMessage() {
          return '$property 只能是站内路径、http/https 链接或数字 ID';
        },
      },
    });
  };
}

/** 非空白字符串：拒绝空串与纯空白（配合 @IsOptional 可跳过缺省字段） */
export function IsNotBlank(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotBlank',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && value.trim().length > 0;
        },
        defaultMessage() {
          return '$property 不能为空或纯空白';
        },
      },
    });
  };
}