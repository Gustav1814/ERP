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
        Schema::create('erp_order_idempotency', function (Blueprint $table) {
            $table->id();
            $table->string('key', 120)->unique();
            $table->foreignId('erp_order_id')->constrained('erp_orders')->cascadeOnDelete();
            $table->json('response_json');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('erp_order_idempotency');
    }
};
