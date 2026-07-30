import { BadRequestException } from '@nestjs/common';
import { assertNotFuture } from './time';

const now = new Date('2026-07-29T12:00:00.000Z');
const minutes = (n: number) => new Date(now.getTime() + n * 60 * 1000);

describe('assertNotFuture', () => {
  it('menerima waktu lampau', () => {
    expect(() => assertNotFuture(minutes(-60).toISOString(), 'occurredAt', now)).not.toThrow();
  });

  it('menerima waktu sekarang', () => {
    expect(() => assertNotFuture(now.toISOString(), 'occurredAt', now)).not.toThrow();
  });

  it('menerima selisih jam klien dalam batas toleransi', () => {
    expect(() => assertNotFuture(minutes(4).toISOString(), 'occurredAt', now)).not.toThrow();
  });

  it('menolak waktu masa depan di luar toleransi', () => {
    expect(() => assertNotFuture(minutes(30).toISOString(), 'occurredAt', now)).toThrow(
      BadRequestException,
    );
  });

  it('menyebut nama field pada pesan error', () => {
    expect(() => assertNotFuture(minutes(60).toISOString(), 'diterimaAt', now)).toThrow(
      /diterimaAt/,
    );
  });

  it('menerima objek Date, bukan hanya string', () => {
    expect(() => assertNotFuture(minutes(-1), 'occurredAt', now)).not.toThrow();
    expect(() => assertNotFuture(minutes(60), 'occurredAt', now)).toThrow(BadRequestException);
  });
});
