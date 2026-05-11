<?php

namespace App\Exceptions;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Support\Facades\Route;
use Throwable;

class Handler extends ExceptionHandler
{
    /**
     * The list of the inputs that are never flashed to the session on validation exceptions.
     *
     * @var array<int, string>
     */
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    /**
     * Register the exception handling callbacks for the application.
     */
    public function register(): void
    {
        $this->reportable(function (Throwable $e) {
            //
        });
    }

    /**
     * API-first app: never fall back to route('login') when that route is absent (would 500).
     */
    protected function unauthenticated($request, AuthenticationException $exception)
    {
        if ($request->expectsJson() || $request->is('api/*')) {
            return response()->json([
                'message' => $exception->getMessage() ?: 'Unauthenticated.',
            ], 401);
        }

        $redirect = $exception->redirectTo();
        if ($redirect !== null) {
            return redirect()->guest($redirect);
        }

        return Route::has('login')
            ? redirect()->guest(route('login'))
            : response()->json([
                'message' => $exception->getMessage() ?: 'Unauthenticated.',
            ], 401);
    }
}
