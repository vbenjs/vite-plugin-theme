export function getVariablesReg(colors: string[]) {
  return new RegExp(
    colors
      .map(
        (i) =>
          `(${i
            .replace(/\s/g, ' ?')
            .replace(/\(/g, `\\(`)
            .replace(/\)/g, `\\)`)
            .replace(/0?\./g, `0?\\.`)})`
      )
      .join('|')
  );
}

export function combineRegs(decorator = '', joinString = '', ...args: any[]) {
  const regString = args
    .map((item) => {
      const str = item.toString();
      return `(${str.slice(1, str.length - 1)})`;
    })
    .join(joinString);
  return new RegExp(regString, decorator);
}

export function formatCss(s: string) {
  s = s.replace(/\s*([{}:;,])\s*/g, '$1');
  s = s.replace(/;\s*;/g, ';');
  s = s.replace(/,[\s.#\d]*{/g, '{');
  s = s.replace(/([^\s])\{([^\s])/g, '$1 {\n\t$2');
  s = s.replace(/([^\s])\}([^\n]*)/g, '$1\n}\n$2');
  s = s.replace(/([^\s]);([^\s}])/g, '$1;\n\t$2');
  return s;
}

export function createHash(hashLength = 8) {
  return Array.from(Array(Number(hashLength)), () =>
    Math.floor(Math.random() * 36).toString(36)
  ).join('');
}
