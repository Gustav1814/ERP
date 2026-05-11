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
        Schema::create('crm_intake_queue', function (Blueprint $table) {
            $table->id();
            $table->string('handoff_jti', 100)->unique();
            $table->unsignedBigInteger('lead_id');
            $table->string('source_order_id', 100)->nullable();
            $table->json('payload_json');
            $table->string('status', 30)->default('pending');
            $table->unsignedBigInteger('erp_company_id')->nullable();
            $table->unsignedBigInteger('erp_order_id')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('crm_intake_queue');
    }
};
