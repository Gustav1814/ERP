<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthMeController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $roles = method_exists($user, 'getRoleNames') ? $user->getRoleNames()->values() : collect();
        $permissions = method_exists($user, 'getAllPermissions')
            ? $user->getAllPermissions()->pluck('name')->values()
            : collect();

        return response()->json([
            'data' => [
                'id' => $user->id,
                'name' => (string) $user->name,
                'email' => (string) $user->email,
                'roles' => $roles,
                'permissions' => $permissions,
                'must_change_password' => (bool) ($user->must_change_password ?? false),
            ],
        ]);
    }
}
