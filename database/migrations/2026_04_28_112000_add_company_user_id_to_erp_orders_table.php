<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('erp_orders', function (Blueprint $table) {
            $table->foreignId('company_user_id')->nullable()->after('company_id')->constrained('company_users')->nullOnDelete();
            $table->index(['company_id', 'company_user_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('erp_orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('company_user_id');
        });
    }
};
