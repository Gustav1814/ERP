<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthPasswordController extends Controller
{
    public function change(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $payload = $request->validate([
            'current_password' => ['nullable', 'string'],
            'new_password' => ['required', 'string', 'min:8'],
        ]);

        $mustChange = (bool) ($user->must_change_password ?? false);
        if (! $mustChange) {
            // For normal password changes, require current password.
            if (! isset($payload['current_password']) || $payload['current_password'] === '') {
                return response()->json(['message' => 'Current password is required.'], 422);
            }
            if (! Hash::check((string) $payload['current_password'], (string) $user->password)) {
                return response()->json(['message' => 'Current password is incorrect.'], 422);
            }
        }

        $user->forceFill([
            'password' => Hash::make((string) $payload['new_password']),
            'must_change_password' => false,
        ])->save();

        return response()->json(['ok' => true]);
    }
}

