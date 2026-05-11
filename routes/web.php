<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/

Route::get('/', function () {
    $spa = public_path('build/index.html');
    if (file_exists($spa)) {
        return response()->file($spa);
    }

    return view('welcome');
});

Route::get('/{any}', function () {
    $spa = public_path('build/index.html');
    if (file_exists($spa)) {
        return response()->file($spa);
    }

    abort(404);
})->where('any', '^(?!api).*$');
