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
        Schema::create('erp_order_details', function (Blueprint $table) {
            $table->id();
            $table->foreignId('erp_order_id')->constrained('erp_orders')->cascadeOnDelete();
            $table->string('order_seq', 100)->nullable();
            $table->string('pk_status', 100)->nullable();
            $table->string('asin', 100)->nullable();
            $table->string('location', 150)->nullable();
            $table->string('make_model', 200)->nullable();
            $table->string('model_type', 150)->nullable();
            $table->string('serial_number', 150)->nullable();
            $table->string('condition', 50)->nullable();
            $table->string('next_steps', 150)->nullable();
            $table->string('market', 100)->nullable();
            $table->string('market_order_id', 150)->nullable();
            $table->decimal('price', 12, 2)->nullable();
            $table->decimal('fees', 12, 2)->nullable();
            $table->decimal('profit', 12, 2)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['erp_order_id', 'order_seq']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('erp_order_details');
    }
};
