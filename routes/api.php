<?php

use App\Http\Controllers\Api\Admin\ActivityLogsController as AdminActivityLogsController;
use App\Http\Controllers\Api\Admin\RolesController as AdminRolesController;
use App\Http\Controllers\Api\Admin\UsersController as AdminUsersController;
use App\Http\Controllers\Api\AdminAuthController;
use App\Http\Controllers\Api\AuthLogoutController;
use App\Http\Controllers\Api\AuthMeController;
use App\Http\Controllers\Api\AuthPasswordController;
use App\Http\Controllers\Api\Crm\AccountManagerController;
use App\Http\Controllers\Api\Crm\CompanyLookupController;
use App\Http\Controllers\Api\Crm\ImportCommitController;
use App\Http\Controllers\Api\Crm\IndustryTypeController;
use App\Http\Controllers\Api\Crm\IntakeController;
use App\Http\Controllers\Api\Crm\InventoryTypeController;
use App\Http\Controllers\Api\Crm\OrderIngestController;
use App\Http\Controllers\Api\Crm\PickupByOptionController;
use App\Http\Controllers\Api\Crm\ServiceCatalogController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

Route::prefix('v1/auth')->group(function () {
    Route::post('/admin/login', [AdminAuthController::class, 'login']);
    Route::middleware('auth:sanctum')->get('/me', [AuthMeController::class, 'show']);
    Route::middleware('auth:sanctum')->post('/logout', [AuthLogoutController::class, 'store']);
    Route::middleware('auth:sanctum')->post('/change-password', [AuthPasswordController::class, 'change']);
});
Route::prefix('v1/crm')->group(function () {
    Route::post('/intake', [IntakeController::class, 'store']);
    Route::post('/intake/capture', [IntakeController::class, 'store']);

});
Route::middleware('auth:sanctum')->prefix('v1/crm')->group(function () {

    // Dashboard / intake
    Route::middleware('permission:dashboard.view,sanctum')->group(function () {
        Route::get('/intake/pending', [IntakeController::class, 'pending']);
        Route::get('/intake/pending/{id}', [IntakeController::class, 'show']);
        Route::post('/intake/pending/{id}/discard', [IntakeController::class, 'discard']);
        Route::post('/import/commit', [ImportCommitController::class, 'store']);
    });

    // Companies
    Route::middleware('permission:companies.view,sanctum')->group(function () {
        Route::get('/companies/search', [CompanyLookupController::class, 'search']);
        Route::get('/companies', [CompanyLookupController::class, 'index']);
    });
    Route::middleware('permission:companies.edit,sanctum')->group(function () {
        Route::patch('/companies/{company}', [CompanyLookupController::class, 'update']);
    });

    // Orders
    Route::middleware('permission:orders.view,sanctum')->group(function () {
        Route::get('/orders/{order}', [OrderIngestController::class, 'show']);
        Route::get('/orders/{order}/certificates/{certificateIndex}/link', [OrderIngestController::class, 'certificateLink']);
        Route::get('/orders/{order}/certificates/{certificateIndex}', [OrderIngestController::class, 'certificate']);
    });
    Route::middleware('permission:orders.edit,sanctum')->group(function () {
        Route::post('/orders', [OrderIngestController::class, 'store']);
        Route::patch('/orders/{order}', [OrderIngestController::class, 'update']);
    });
    Route::middleware('permission:orders.edit|orders.upload_certificates,sanctum')->group(function () {
        Route::post('/orders/{order}/certificates/presign', [OrderIngestController::class, 'presignCertificateUploads']);
        Route::post('/orders/{order}/certificates/register', [OrderIngestController::class, 'registerCertificates']);
        Route::post('/orders/{order}/certificates', [OrderIngestController::class, 'uploadCertificates']);
    });

    // Settings (CRM options used in ERP)
    Route::middleware('permission:settings.view,sanctum')->group(function () {
        Route::get('/settings/services', [ServiceCatalogController::class, 'index']);
        Route::get('/settings/inventory-types', [InventoryTypeController::class, 'index']);
        Route::get('/settings/pickup-by', [PickupByOptionController::class, 'index']);
        Route::get('/settings/industry-types', [IndustryTypeController::class, 'index']);
        Route::get('/settings/account-managers', [AccountManagerController::class, 'index']);
    });
    Route::middleware('permission:settings.manage,sanctum')->group(function () {
        Route::post('/settings/services', [ServiceCatalogController::class, 'store']);
        Route::patch('/settings/services/{service}', [ServiceCatalogController::class, 'update']);
        Route::delete('/settings/services/{service}', [ServiceCatalogController::class, 'destroy']);

        Route::post('/settings/inventory-types', [InventoryTypeController::class, 'store']);
        Route::patch('/settings/inventory-types/{inventoryType}', [InventoryTypeController::class, 'update']);
        Route::delete('/settings/inventory-types/{inventoryType}', [InventoryTypeController::class, 'destroy']);

        Route::post('/settings/pickup-by', [PickupByOptionController::class, 'store']);
        Route::patch('/settings/pickup-by/{pickupByOption}', [PickupByOptionController::class, 'update']);
        Route::delete('/settings/pickup-by/{pickupByOption}', [PickupByOptionController::class, 'destroy']);

        Route::post('/settings/industry-types', [IndustryTypeController::class, 'store']);
        Route::patch('/settings/industry-types/{industryType}', [IndustryTypeController::class, 'update']);
        Route::delete('/settings/industry-types/{industryType}', [IndustryTypeController::class, 'destroy']);

        Route::post('/settings/account-managers', [AccountManagerController::class, 'store']);
        Route::patch('/settings/account-managers/{accountManager}', [AccountManagerController::class, 'update']);
        Route::delete('/settings/account-managers/{accountManager}', [AccountManagerController::class, 'destroy']);
    });
});

Route::middleware(['auth:sanctum'])->prefix('v1/admin')->group(function () {
    /** Role list + permission catalog: needed for user forms (assign role) and roles UI. */
    Route::middleware('permission:users.manage|roles.manage,sanctum')->group(function () {
        Route::get('/roles', [AdminRolesController::class, 'index']);
    });

    Route::middleware('permission:users.manage,sanctum')->group(function () {
        Route::get('/users', [AdminUsersController::class, 'index']);
        Route::post('/users', [AdminUsersController::class, 'store']);
        Route::patch('/users/{user}', [AdminUsersController::class, 'update']);
    });

    Route::middleware('permission:roles.manage,sanctum')->group(function () {
        Route::post('/roles', [AdminRolesController::class, 'store']);
        Route::patch('/roles/{role}', [AdminRolesController::class, 'update']);
    });

    Route::middleware('permission:auditlogs.view,sanctum')->group(function () {
        Route::get('/activity-logs', [AdminActivityLogsController::class, 'index']);
    });
});
