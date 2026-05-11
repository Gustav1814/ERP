<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AdminAuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $email = strtolower((string) $credentials['email']);
        $user = User::query()->whereRaw('LOWER(email) = ?', [$email])->first();

        if (!$user || !Hash::check($credentials['password'], (string) $user->password)) {
            return response()->json([
                'message' => 'Invalid admin credentials.',
            ], 401);
        }

        $token = $user->createToken('erp-login')->plainTextToken;

        $roles = method_exists($user, 'getRoleNames') ? $user->getRoleNames()->values() : collect();
        $permissions = method_exists($user, 'getAllPermissions')
            ? $user->getAllPermissions()->pluck('name')->values()
            : collect();

        return response()->json([
            'token' => $token,
            'id' => $user->id,
            'name' => (string) $user->name,
            'email' => strtolower((string) $user->email),
            'roles' => $roles,
            'permissions' => $permissions,
            'must_change_password' => (bool) ($user->must_change_password ?? false),
        ]);
    }
}
