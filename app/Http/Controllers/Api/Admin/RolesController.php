<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesController extends Controller
{
    public function index(): JsonResponse
    {
        $roles = Role::query()
            ->orderBy('name')
            ->get()
            ->map(function (Role $r) {
                return [
                    'id' => $r->id,
                    'name' => (string) $r->name,
                    'permissions' => $r->permissions()->pluck('name')->values(),
                ];
            })
            ->values();

        $permissions = Permission::query()->orderBy('name')->pluck('name')->values();

        return response()->json([
            'data' => [
                'roles' => $roles,
                'permissions' => $permissions,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150', Rule::unique('roles', 'name')],
            'permissions' => ['array'],
            'permissions.*' => ['string'],
        ]);

        if (strcasecmp((string) $data['name'], 'Super Admin') === 0 && ! $request->user()->hasRole('Super Admin')) {
            return response()->json(['message' => 'Only Super Admin can create the Super Admin role.'], 403);
        }

        $role = Role::query()->create([
            'name' => (string) $data['name'],
            'guard_name' => 'web',
        ]);

        $this->syncPermissions($role, $data['permissions'] ?? []);

        ActivityLogger::record(
            'roles.create',
            Role::class,
            (int) $role->id,
            [
                'name' => (string) $role->name,
                'permissions' => $role->permissions()->pluck('name')->values(),
            ],
            $request,
        );

        return response()->json([
            'data' => [
                'id' => $role->id,
                'name' => (string) $role->name,
                'permissions' => $role->permissions()->pluck('name')->values(),
            ],
        ], 201);
    }

    public function update(Request $request, Role $role): JsonResponse
    {
        if ($role->name === 'Super Admin' && ! $request->user()->hasRole('Super Admin')) {
            return response()->json(['message' => 'Only Super Admin can modify the Super Admin role.'], 403);
        }

        if ($request->user()->hasRole($role->name)) {
            return response()->json(['message' => 'You cannot modify a role that is assigned to your own account.'], 403);
        }

        $before = [
            'name' => (string) $role->name,
            'permissions' => $role->permissions()->pluck('name')->values()->all(),
        ];

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:150', Rule::unique('roles', 'name')->ignore($role->id)],
            'permissions' => ['sometimes', 'array'],
            'permissions.*' => ['string'],
        ]);

        if (isset($data['name'])) {
            $nextName = (string) $data['name'];
            if ($role->name === 'Super Admin' && strcasecmp($nextName, 'Super Admin') !== 0 && ! $request->user()->hasRole('Super Admin')) {
                return response()->json(['message' => 'Only Super Admin can rename the Super Admin role.'], 403);
            }
            $role->name = $nextName;
            $role->save();
        }

        if (array_key_exists('permissions', $data)) {
            $this->syncPermissions($role, $data['permissions'] ?? []);
        }

        $after = [
            'name' => (string) $role->name,
            'permissions' => $role->permissions()->pluck('name')->values()->all(),
        ];

        ActivityLogger::record(
            'roles.update',
            Role::class,
            (int) $role->id,
            [
                'name' => (string) $role->name,
                'before' => $before,
                'after' => $after,
            ],
            $request,
        );

        return response()->json([
            'data' => [
                'id' => $role->id,
                'name' => (string) $role->name,
                'permissions' => $role->permissions()->pluck('name')->values(),
            ],
        ]);
    }

    private function syncPermissions(Role $role, array $permissionNames): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $allowed = Permission::query()->whereIn('name', $permissionNames)->get();
        $role->syncPermissions($allowed);
    }
}
