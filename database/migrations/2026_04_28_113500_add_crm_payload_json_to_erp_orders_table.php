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
            $table->json('crm_payload_json')->nullable()->after('attachments_json');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('erp_orders', function (Blueprint $table) {
            $table->dropColumn('crm_payload_json');
        });
    }
};
