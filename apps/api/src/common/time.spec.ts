import { BadRequestException } from '@nestjs/common';
import { assertNotFuture } from './time';

const now = new Date('2026-07-29T12:00:00.000Z');
const minutes = (n: number) => new Date(now.getTime() + n * 60 * 1000);

describe('assertNotFuture', () => {
  it('menerima waktu lampau', () => {
    expect(() => assertNotFuture(minutes(-60).toISOString(), 'Waktu kejadian', now)).not.toThrow();
  });

  it('menerima waktu sekarang', () => {
    expect(() => assertNotFuture(now.toISOString(), 'Waktu kejadian', now)).not.toThrow();
  });

  it('menerima selisih jam klien dalam batas toleransi', () => {
    expect(() => assertNotFuture(minutes(4).toISOString(), 'Waktu kejadian', now)).not.toThrow();
  });

  it('menolak waktu masa depan di luar toleransi', () => {
    expect(() => assertNotFuture(minutes(30).toISOString(), 'Waktu kejadian', now)).toThrow(
      BadRequestException,
    );
  });

  // Pesan error dibaca langsung pengguna lewat toast, jadi harus menyebut label
  // form ("Waktu diterima") plus alasannya, bukan nama field API ("diterimaAt").
  it('memakai label form dan menjelaskan alasan pada pesan error', () => {
    expect(() => assertNotFuture(minutes(60).toISOString(), 'Waktu diterima', now)).toThrow(
      /Waktu diterima tidak boleh melewati waktu sekarang.*sudah terjadi, bukan rencana/s,
    );
  });

  it('menerima objek Date, bukan hanya string', () => {
    expect(() => assertNotFuture(minutes(-1), 'Waktu kejadian', now)).not.toThrow();
    expect(() => assertNotFuture(minutes(60), 'Waktu kejadian', now)).toThrow(BadRequestException);
  });
});
