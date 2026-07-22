import { buildCsv } from './csv';

describe('buildCsv', () => {
  it('menggabung header dan baris dengan CRLF', () => {
    const csv = buildCsv(['a', 'b'], [[1, 2], [3, 4]]);
    expect(csv).toBe('a,b\r\n1,2\r\n3,4');
  });

  it('mengutip sel dengan koma, kutip, atau newline dan meng-escape kutip', () => {
    const csv = buildCsv(['x'], [['a,b'], ['he said "hi"'], ['baris\nbaru']]);
    expect(csv).toBe('x\r\n"a,b"\r\n"he said ""hi"""\r\n"baris\nbaru"');
  });
});
