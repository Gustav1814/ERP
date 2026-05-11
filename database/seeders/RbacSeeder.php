<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RbacSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $permissions = [
            'dashboard.view',
            'companies.view',
            'companies.edit',
            'orders.view',
            'orders.edit',
            'orders.upload_certificates',
            'settings.view',
            'settings.manage',
            'users.manage',
            'roles.manage',
            'auditlogs.view',
        ];

        foreach ($permissions as $name) {
            Permission::query()->where('name', $name)->update(['guard_name' => 'sanctum']);
            Permission::query()->firstOrCreate(['name' => $name, 'guard_name' => 'sanctum']);
        }

        Role::query()->whereIn('name', ['Super Admin', 'Admin', 'Staff'])->update(['guard_name' => 'sanctum']);
        $superAdmin = Role::query()->firstOrCreate(['name' => 'Super Admin', 'guard_name' => 'sanctum']);
        $superAdmin->syncPermissions(Permission::query()->whereIn('name', $permissions)->get());

        $admin = Role::query()->firstOrCreate(['name' => 'Admin', 'guard_name' => 'sanctum']);
        $admin->syncPermissions(Permission::query()->whereIn('name', [
            'dashboard.view',
            'companies.view',
            'companies.edit',
            'orders.view',
            'orders.edit',
            'orders.upload_certificates',
            'settings.view',
            'settings.manage',
            'users.manage',
            'roles.manage',
        ])->get());

        $staff = Role::query()->firstOrCreate(['name' => 'Staff', 'guard_name' => 'sanctum']);
        $staff->syncPermissions(Permission::query()->whereIn('name', [
            'dashboard.view',
            'companies.view',
            'orders.view',
        ])->get());

        // Ensure a super-admin exists for internal ERP usage (no public registration).
        // Idempotent: create/update the seeded email user and always assign Super Admin.
        $seedEmail = strtolower((string) (env('ERP_SUPERADMIN_EMAIL') ?: 'shah@mobiwhiz.com'));
        $seedPassword = (string) (env('ERP_SUPERADMIN_PASSWORD') ?: 'ChangeMe123!');

        $user = User::query()->whereRaw('LOWER(email) = ?', [$seedEmail])->first();
        if (! $user) {
            $user = User::query()->create([
                'name' => 'Super Admin',
                'email' => $seedEmail,
                'password' => Hash::make($seedPassword),
                'must_change_password' => true,
            ]);
        }

        $user->syncRoles([$superAdmin]);
    }
}
