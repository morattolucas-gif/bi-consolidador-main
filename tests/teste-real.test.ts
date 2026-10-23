import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { ehBaseBtgExcel, lerBaseBtgExcel } from '../src/parsers/base-btg';
import { processarArquivo } from '../src/parsers/pasta';
import { S } from '../src/domain/state';
import { renderBaseClientes } from '../src/components/views/base-clientes';

describe('Simula processo completo no browser com DOM', () => {
  it('processa e renderiza sem nenhum erro', async () => {
    // Mock do DOM mínimo
    const elements = new Map<string, any>();
    const mockEl = (id: string) => {
      if (!elements.has(id)) {
        elements.set(id, {
          id,
          hidden: false,
          textContent: '',
          innerHTML: '',
          style: {},
          classList: { add() {}, remove() {} },
          querySelectorAll: () => [],
          querySelector: () => null,
          addEventListener: () => {},
          setAttribute: () => {},
          removeAttribute: () => {}
        });
      }
      return elements.get(id);
    };

    (global as any).document = {
      getElementById: (id: string) => mockEl(id),
      querySelector: (s: string) => mockEl(s.replace(/^[#.]/, '')),
      querySelectorAll: () => [],
      createElement: (tag: string) => mockEl('tag-' + tag),
      body: mockEl('body'),
      addEventListener: () => {}
    };
    (global as any).window = global;
    (global as any).alert = (msg: string) => console.log('ALERT CHAMADO:', msg);
    (global as any).localStorage = { getItem: () => null, setItem: () => {} };
    (global as any).indexedDB = {
      open: () => {
        const req: any = {};
        setTimeout(() => {
          req.result = {
            transaction: () => {
              const tx: any = {
                objectStore: () => ({
                  put: () => {},
                  get: () => ({ onsuccess: null })
                }),
                oncomplete: null,
                onerror: null
              };
              setTimeout(() => { if (tx.oncomplete) tx.oncomplete(); }, 5);
              return tx;
            }
          };
          if (req.onsuccess) req.onsuccess();
        }, 5);
        return req;
      }
    };

    if (!fs.existsSync('Base BTG (32).xlsx')) {
      console.log('Base BTG (32).xlsx não encontrado no ambiente; pulando teste local.');
      return;
    }

    const buf = fs.readFileSync('Base BTG (32).xlsx');
    const file = new File([buf], 'Base BTG (32).xlsx');

    const res = await processarArquivo(file);
    console.log('Resultado:', res);
    expect(res.baseBtg).toBe(true);
    expect(S.baseBtg.length).toBe(3659);

    // Agora testa renderBaseClientes()
    mockEl('aba-base');
    renderBaseClientes();
    console.log('renderBaseClientes completou com sucesso! Tamanho do HTML gerado:', mockEl('aba-base').innerHTML.length);
    expect(mockEl('aba-base').innerHTML.length).toBeGreaterThan(100);
  }, 25000);
});
