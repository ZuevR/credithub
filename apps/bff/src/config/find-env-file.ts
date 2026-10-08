import { existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';

/**
 * Находит `.env` в корне монорепо, поднимаясь вверх от текущего файла.
 *
 * Считать путь через фиксированное число `../` нельзя: из исходников и из
 * собранного `dist` глубина разная, и одна из двух веток молча получила бы
 * неверный путь (а `@nestjs/config` при отсутствии файла не падает - просто
 * не находит переменные, что потом всплывает непонятной ошибкой подключения).
 *
 * @returns путь к `.env` либо `undefined`, если файла нет (тогда работают
 *          переменные окружения процесса и значения по умолчанию).
 */
export function findEnvFile(startDir: string = __dirname): string | undefined {
  let current = startDir;
  const { root } = parse(current);

  while (true) {
    const candidate = join(current, '.env');
    if (existsSync(candidate)) return candidate;

    const parent = dirname(current);
    if (parent === current || current === root) return undefined;
    current = parent;
  }
}
