/**
 * Содержимое раздела «Программы» — публичная часть, которую на 3c будет
 * рендерить сервер. Пока это обычный React-компонент: задача 3b — убедиться,
 * что Rsbuild-remote вообще грузится в shell наравне с rspack-овыми.
 */
export function ProgramsSection() {
  return (
    <section data-testid="programs-section">
      <h2>Программы</h2>
      <p>Публичный раздел, который будет отдаваться серверным рендером.</p>
    </section>
  );
}

export default ProgramsSection;
