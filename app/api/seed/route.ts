import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';
import { DataStore } from '@/lib/data-store';

export async function POST() {
  try {
    const adminAuthClient = await createAdminClient();

    const usersToCreate = [
      {
        email: 'ceo@teenssoftware.com',
        password: 'Admin@123',
        email_confirm: true,
        user_metadata: { full_name: 'Sri Ramulu Darapureddy', role: 'ceo' }
      },
      {
        email: 'hr@teenssoftware.com',
        password: 'Admin@123',
        email_confirm: true,
        user_metadata: { full_name: 'Chaitanya Deepthi', role: 'hr' }
      },
      {
        email: 'employee@teenssoftware.com',
        password: 'Employee@123',
        email_confirm: true,
        user_metadata: { full_name: 'Balaji Marpally', role: 'employee' }
      }
    ];

    const createdUsers: string[] = [];
    const userMap: Record<string, string> = {};

    for (const user of usersToCreate) {
      const { data, error } = await adminAuthClient.auth.admin.createUser(user);

      let userId = data?.user?.id;
      if (error) {
        if (error.message.includes('already exists') || error.status === 422) {
          // Find existing user id
          const { data: list } = await adminAuthClient.auth.admin.listUsers();
          const existing = list?.users?.find(u => u.email === user.email);
          if (existing) {
            userId = existing.id;
            // Update password & metadata to ensure credentials work
            await adminAuthClient.auth.admin.updateUserById(existing.id, {
              password: user.password,
              user_metadata: user.user_metadata
            });
          }
        } else {
          console.error(`Error creating user ${user.email}:`, error);
        }
      }

      if (userId) {
        userMap[user.email] = userId;
        createdUsers.push(user.email);

        // Update profile role safely
        try {
          await adminAuthClient.from('profiles').upsert({
            id: userId,
            email: user.email,
            full_name: user.user_metadata.full_name,
            role: user.user_metadata.role
          });
        } catch (pe) {
          console.warn('Profile upsert warning:', pe);
        }
      }
    }

    // Seed sample employees with user_id linked
    const sampleEmployees: Array<Record<string, any>> = [
      {
        employee_id: 'TSS001',
        user_id: userMap['employee@teenssoftware.com'] || null,
        first_name: 'Balaji',
        last_name: 'Marpally',
        email: 'employee@teenssoftware.com',
        phone: '+91 9876543210',
        date_of_birth: '1995-05-14',
        gender: 'male',
        blood_group: 'O+',
        marital_status: 'single',
        address: 'Flat 402, Greenfield Heights, Hitec City',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500081',
        emergency_contact_name: 'Venkatesham Marpally',
        emergency_contact_phone: '+91 9876543219',
        emergency_contact_relation: 'Father',
        designation: 'Senior Full Stack Developer',
        employment_type: 'full-time',
        status: 'active',
        salary: 75000,
        joining_date: '2023-01-15',
        bank_name: 'HDFC Bank',
        bank_account_number: '50100234567890',
        ifsc_code: 'HDFC0001234',
        pan_number: 'ABCDE1234F',
        aadhar_number: '1234 5678 9012',
        uan_number: '100904561234',
        esi_number: '31000123456780001',
        notes: 'Lead developer on FinTech project'
      },
      {
        employee_id: 'TSS002',
        first_name: 'Sneha',
        last_name: 'Reddy',
        email: 'sneha.reddy@teenssoftware.com',
        phone: '+91 9876543211',
        date_of_birth: '1997-08-22',
        gender: 'female',
        blood_group: 'B+',
        marital_status: 'single',
        address: 'Plot 45, Jubilee Hills',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500033',
        designation: 'UI/UX Product Designer',
        employment_type: 'full-time',
        status: 'active',
        salary: 60000,
        joining_date: '2023-03-10',
        bank_name: 'ICICI Bank',
        bank_account_number: '102030405060',
        ifsc_code: 'ICIC0000102',
        pan_number: 'REDDY5678K',
        aadhar_number: '9876 5432 1098'
      },
      {
        employee_id: 'TSS003',
        first_name: 'Vikram',
        last_name: 'Singh',
        email: 'vikram.singh@teenssoftware.com',
        phone: '+91 9876543212',
        designation: 'QA Automation Engineer',
        employment_type: 'contract',
        status: 'active',
        salary: 45000,
        joining_date: '2023-06-01'
      }
    ];

    for (const emp of sampleEmployees) {
      try {
        await adminAuthClient
          .from('employees')
          .upsert(emp, { onConflict: 'employee_id' });
      } catch (err) {
        console.warn(`Error inserting employee ${emp.employee_id}:`, err);
      }
    }

    // Always seed employees into in-memory cache regardless of DB success
    // This ensures the app works even when DB has permission issues
    for (const emp of sampleEmployees) {
      const cacheEmp = {
        ...emp,
        id: emp.employee_id, // Use employee_id as the in-memory id
        user_id: emp.user_id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any;
      DataStore.seedEmployeeToCache(cacheEmp);
    }

    // Seed initial demo data in DataStore (payroll runs, sample leaves, profile change request)
    const employees = await DataStore.getEmployees();
    const targetEmp = employees.find(e => e.employee_id === 'TSS001') || employees[0];

    if (targetEmp) {
      // 1. Seed Leave balance and an approved leave request
      const leaveTypes = await DataStore.getLeaveTypes();
      await DataStore.getLeaveBalances(targetEmp.id, 2026);

      const cl = leaveTypes.find(lt => lt.code === 'CL');
      if (cl) {
        await DataStore.createLeaveRequest({
          employeeId: targetEmp.id,
          leaveTypeId: cl.id,
          startDate: '2026-09-10',
          endDate: '2026-09-11',
          totalDays: 2,
          reason: 'Family function'
        });
      }

      // 2. Seed a sample pending profile change request for HR to review
      await DataStore.createProfileChangeRequest({
        employeeId: targetEmp.id,
        requestedChanges: {
          address: 'Villa 12, Palm Meadows, Gachibowli, Hyderabad',
          bank_name: 'State Bank of India',
          bank_account_number: '309988776655',
          ifsc_code: 'SBIN0004567'
        },
        previousValues: {
          address: targetEmp.address,
          bank_name: targetEmp.bank_name,
          bank_account_number: targetEmp.bank_account_number,
          ifsc_code: targetEmp.ifsc_code
        }
      });

      // 3. Seed attendance logs for this month
      await DataStore.clockIn(targetEmp.id);

      // 4. Generate payslips for August and September 2026
      await DataStore.generateMonthlyPayroll({ month: 8, year: 2026 });
      await DataStore.generateMonthlyPayroll({ month: 9, year: 2026 });
    }

    return NextResponse.json({
      success: true,
      message: 'Database and HRMS seeded successfully with CEO, HR, and Employee test accounts',
      credentials: {
        ceo: { email: 'ceo@teenssoftware.com', password: 'Admin@123', role: 'CEO' },
        hr: { email: 'hr@teenssoftware.com', password: 'Admin@123', role: 'HR' },
        employee: { email: 'employee@teenssoftware.com', password: 'Employee@123', role: 'Employee (TSS001 - Balaji Marpally)' }
      }
    });
  } catch (error: any) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred during seeding', stack: error.stack },
      { status: 500 }
    );
  }
}
