import { Reflector } from '@nestjs/core';
import { Role } from '@mold-tracker/shared';
import { JobsController } from '../jobs/jobs.controller';
import { MachinesController } from '../machines/machines.controller';
import { MaintenanceController } from '../maintenance/maintenance.controller';
import { DashboardController } from '../dashboard/dashboard.controller';

// Super Admin harus bisa memakai seluruh fitur Admin Sundaya; bedanya hanya
// Super Admin yang mengelola pengguna. Aturan itu gampang bocor diam-diam saat
// endpoint baru ditulis dengan @Roles(Role.ADMIN_SUNDAYA) saja, jadi diuji di
// sini sekali untuk semua controller staf Sundaya.
describe('Kesetaraan wewenang Super Admin dan Admin Sundaya', () => {
  const reflector = new Reflector();

  const controllers = [
    JobsController,
    MachinesController,
    MaintenanceController,
    DashboardController,
  ];

  const handlerRoles = (controller: new (...args: never[]) => object) => {
    const proto = controller.prototype as Record<string, unknown>;
    return Object.getOwnPropertyNames(proto)
      .filter((name) => name !== 'constructor' && typeof proto[name] === 'function')
      .map((name) => ({
        nama: `${controller.name}.${name}`,
        roles: reflector.get<Role[] | undefined>('roles', proto[name] as () => unknown),
      }))
      .filter((h) => h.roles != null);
  };

  it('tidak ada endpoint staf yang memberi Admin Sundaya tapi melewatkan Super Admin', () => {
    const bocor = controllers
      .flatMap(handlerRoles)
      .filter((h) => h.roles!.includes(Role.ADMIN_SUNDAYA) && !h.roles!.includes(Role.SUPER_ADMIN))
      .map((h) => h.nama);

    expect(bocor).toEqual([]);
  });
});
