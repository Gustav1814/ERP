<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;

class UsersController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));

        $users = User::query()
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($inner) use ($q) {
                    $inner->where('name', 'like', "%{$q}%")
                        ->orWhere('email', 'like', "%{$q}%");
                });
            })
            ->orderBy('name')
            ->limit(250)
            ->get()
            ->map(function (User $u) {
                return [
                    'id' => $u->id,
                    'name' => (string) $u->name,
                    'email' => (string) $u->email,
                    'roles' => method_exists($u, 'getRoleNames') ? $u->getRoleNames()->values() : [],
                    'must_change_password' => (bool) ($u->must_change_password ?? false),
                    'created_at' => optional($u->created_at)->toISOString(),
                ];
            })
            ->values();

        return response()->json(['data' => $users]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'email', 'max:150', Rule::unique('users', 'email')],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', 'string', 'max:150'],
        ]);

        $role = Role::query()->where('name', $data['role'])->first();
        if (! $role) {
            return response()->json(['message' => 'Role not found.'], 422);
        }

        if ($role->name === 'Super Admin' && ! $request->user()->hasRole('Super Admin')) {
            return response()->json(['message' => 'Only Super Admin can assign the Super Admin role.'], 403);
        }

        $user = User::query()->create([
            'name' => $data['name'],
            'email' => strtolower((string) $data['email']),
            'password' => Hash::make((string) $data['password']),
            'must_change_password' => true,
        ]);
        $user->syncRoles([$role]);

        ActivityLogger::record(
            'users.create',
            User::class,
            (int) $user->id,
            [
                'name' => (string) $user->name,
                'email' => (string) $user->email,
                'role' => (string) $role->name,
            ],
            $request,
        );

        return response()->json([
            'data' => [
                'id' => $user->id,
                'name' => (string) $user->name,
                'email' => (string) $user->email,
                'roles' => $user->getRoleNames()->values(),
                'must_change_password' => true,
                'created_at' => optional($user->created_at)->toISOString(),
            ],
        ], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        if ($user->hasRole('Super Admin') && ! $request->user()->hasRole('Super Admin')) {
            return response()->json(['message' => 'Only Super Admin can modify Super Admin accounts.'], 403);
        }

        $before = [
            'name' => (string) $user->name,
            'email' => (string) $user->email,
            'roles' => method_exists($user, 'getRoleNames') ? $user->getRoleNames()->values()->all() : [],
            'must_change_password' => (bool) ($user->must_change_password ?? false),
        ];

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'email' => ['sometimes', 'email', 'max:150', Rule::unique('users', 'email')->ignore($user->id)],
            'role' => ['sometimes', 'string', 'max:150'],
            'reset_password' => ['sometimes', 'boolean'],
            'password' => ['nullable', 'string', 'min:8'],
        ]);

        if ($user->id === (int) $request->user()->id && array_key_exists('role', $data)) {
            return response()->json(['message' => 'You cannot change your own role.'], 403);
        }

        if (array_key_exists('name', $data)) {
            $user->name = (string) $data['name'];
        }
        if (array_key_exists('email', $data)) {
            $user->email = strtolower((string) $data['email']);
        }

        if (! empty($data['role'])) {
            $role = Role::query()->where('name', $data['role'])->first();
            if (! $role) {
                return response()->json(['message' => 'Role not found.'], 422);
            }
            if ($role->name === 'Super Admin' && ! $request->user()->hasRole('Super Admin')) {
                return response()->json(['message' => 'Only Super Admin can assign the Super Admin role.'], 403);
            }
            $user->syncRoles([$role]);
        }

        if (! empty($data['reset_password'])) {
            if (! isset($data['password']) || trim((string) $data['password']) === '') {
                return response()->json(['message' => 'Password is required to reset.'], 422);
            }
            $user->password = Hash::make((string) $data['password']);
            $user->must_change_password = true;
        }

        $user->save();

        $after = [
            'name' => (string) $user->name,
            'email' => (string) $user->email,
            'roles' => $user->getRoleNames()->values()->all(),
            'must_change_password' => (bool) ($user->must_change_password ?? false),
        ];

        ActivityLogger::record(
            'users.update',
            User::class,
            (int) $user->id,
            [
                'name' => (string) $user->name,
                'before' => $before,
                'after' => $after,
            ],
            $request,
        );

        return response()->json([
            'data' => [
                'id' => $user->id,
                'name' => (string) $user->name,
                'email' => (string) $user->email,
                'roles' => $user->getRoleNames()->values(),
                'must_change_password' => (bool) ($user->must_change_password ?? false),
                'created_at' => optional($user->created_at)->toISOString(),
            ],
        ]);
    }
}
