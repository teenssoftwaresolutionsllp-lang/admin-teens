import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';

export async function POST() {
  try {
    const adminAuthClient = await createAdminClient();
    
    const usersToCreate = [
      {
        email: 'ceo@teenssoftware.com',
        password: 'Admin@123',
        email_confirm: true,
        user_metadata: { full_name: 'Rajesh Kumar', role: 'ceo' }
      },
      {
        email: 'hr@teenssoftware.com',
        password: 'Admin@123',
        email_confirm: true,
        user_metadata: { full_name: 'Priya Sharma', role: 'hr' }
      }
    ];

    const createdUsers = [];

    for (const user of usersToCreate) {
      const { data, error } = await adminAuthClient.auth.admin.createUser(user);
      
      if (error) {
        if (error.message.includes('already exists') || error.status === 422) {
          console.log(`User ${user.email} already exists or error. Continuing...`);
        } else {
          console.error(`Error creating user ${user.email}:`, error);
        }
      } else if (data?.user) {
        createdUsers.push(user.email);
        
        const { error: profileError } = await adminAuthClient
          .from('profiles')
          .upsert({
            id: data.user.id,
            email: user.email,
            full_name: user.user_metadata.full_name,
            role: user.user_metadata.role
          });
          
        if (profileError) {
          console.error(`Error updating profile for ${user.email}:`, profileError);
        }
      }
    }

    const sampleEmployees = [
      {
        employee_id: 'TSS001',
        first_name: 'Amit',
        last_name: 'Patel',
        email: 'amit.patel@teenssoftware.com',
        phone: '9876543210',
        designation: 'Senior Developer',
        employment_type: 'full-time',
        status: 'active',
        joining_date: '2023-01-15'
      },
      {
        employee_id: 'TSS002',
        first_name: 'Sneha',
        last_name: 'Reddy',
        email: 'sneha.reddy@teenssoftware.com',
        phone: '9876543211',
        designation: 'UI/UX Designer',
        employment_type: 'full-time',
        status: 'active',
        joining_date: '2023-03-10'
      },
      {
        employee_id: 'TSS003',
        first_name: 'Vikram',
        last_name: 'Singh',
        email: 'vikram.singh@teenssoftware.com',
        phone: '9876543212',
        designation: 'QA Engineer',
        employment_type: 'contract',
        status: 'active',
        joining_date: '2023-06-01'
      }
    ];

    for (const emp of sampleEmployees) {
      const { error } = await adminAuthClient
        .from('employees')
        .upsert(emp, { onConflict: 'employee_id' });
        
      if (error) {
        console.error(`Error inserting employee ${emp.employee_id}:`, error);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Seed data created successfully',
      created_users: createdUsers
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: 'An error occurred during seeding' },
      { status: 500 }
    );
  }
}
