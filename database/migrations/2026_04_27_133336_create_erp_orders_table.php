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
        Schema::create('erp_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies');
            $table->foreignId('billing_address_id')->nullable()->constrained('company_addresses');
            $table->foreignId('pickup_address_id')->nullable()->constrained('company_addresses');
            $table->string('source_system', 50);
            $table->unsignedBigInteger('source_lead_id');
            $table->string('source_order_id', 50)->nullable();
            $table->string('title', 200)->nullable();
            $table->text('type_of_equipment')->nullable();
            $table->string('quantity', 50)->nullable();
            $table->decimal('estimate_value', 12, 2)->nullable();
            $table->decimal('pickup_cost', 12, 2)->nullable();
            $table->string('pickup_cost_status', 50)->nullable();
            $table->string('status', 50)->default('new');
            $table->string('qualify_status', 50)->nullable();
            $table->string('data_destruction_type', 100)->nullable();
            $table->text('message')->nullable();
            $table->json('attachments_json')->nullable();
            $table->date('start_date')->nullable();
            $table->date('pickup_date')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['source_system', 'source_lead_id'], 'erp_orders_source_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('erp_orders');
    }
};
