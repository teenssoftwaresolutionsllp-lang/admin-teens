--
-- PostgreSQL database dump
--

\restrict dJScbzaL2r0jxFv7fEsfSJNm6w31W0jw4xweTI05Os74ikcOXhxPcUQOTaa7a6z

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.3 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id, 
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'employee')
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;
  RETURN new;
END;
$$;


--
-- Name: review_employee_document(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.review_employee_document(p_document_id uuid, p_decision text, p_review_notes text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_user_id uuid;
    v_role text;
    v_document public.employee_documents%ROWTYPE;
    v_request public.profile_change_requests%ROWTYPE;
    v_decision text := lower(trim(coalesce(p_decision, '')));
    v_notes text := nullif(trim(coalesce(p_review_notes, '')), '');
    v_sensitive boolean := false;
    v_profile_approved boolean := false;
    v_changes jsonb := '{}'::jsonb;
    v_type text;
BEGIN
    -- Validate the requested action and review notes.
    IF v_decision NOT IN ('approve', 'reject') THEN
        RAISE EXCEPTION 'Decision must be approve or reject.';
    END IF;

    IF length(coalesce(v_notes, '')) > 2000 THEN
        RAISE EXCEPTION 'Review notes cannot exceed 2000 characters.';
    END IF;

    IF v_decision = 'reject' AND v_notes IS NULL THEN
        RAISE EXCEPTION 'Please provide a reason for rejection.';
    END IF;

    -- Authenticate reviewer.
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized.';
    END IF;

    SELECT lower(trim(p.role))
    INTO v_role
    FROM public.profiles AS p
    WHERE p.id = v_user_id;

    IF v_role IS NULL OR v_role NOT IN ('hr', 'ceo') THEN
        RAISE EXCEPTION 'Only HR and CEO can review documents.';
    END IF;

    -- Lock the document being reviewed.
    SELECT *
    INTO v_document
    FROM public.employee_documents AS d
    WHERE d.id = p_document_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Document not found.';
    END IF;

    v_type := lower(trim(coalesce(v_document.document_type, '')));

    v_sensitive := v_type IN (
        'aadhaar card', 'aadhar card', 'aadhaar', 'aadhar',
        'pan card', 'passport', 'bank passbook'
    );

    -- Sensitive documents may be pending or verified.
    IF (
        (NOT v_sensitive
            AND lower(coalesce(v_document.verification_status, '')) <> 'pending')
        OR
        (v_sensitive
            AND lower(coalesce(v_document.verification_status, ''))
                NOT IN ('pending', 'verified'))
    ) THEN
        RAISE EXCEPTION 'Document is not in a reviewable status.';
    END IF;

    -- Validate the linked request for sensitive documents.
    IF v_sensitive THEN
        IF v_document.profile_change_request_id IS NULL THEN
            RAISE EXCEPTION
                'Sensitive documents must be linked to a profile change request.';
        END IF;

        SELECT *
        INTO v_request
        FROM public.profile_change_requests AS r
        WHERE r.id = v_document.profile_change_request_id
          AND r.employee_id = v_document.employee_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Linked profile change request not found.';
        END IF;

        v_profile_approved :=
            lower(trim(coalesce(v_request.status, ''))) = 'approved';

        v_changes := coalesce(v_request.requested_changes, '{}'::jsonb);

        -- Ensure request fields are consistent with the document.
        IF v_type = 'bank passbook' THEN
            IF v_changes ?| ARRAY[
                'aadhar_number', 'aadhaar_number',
                'pan_number', 'passport_number'
            ] THEN
                RAISE EXCEPTION
                    'Bank Passbook request contains unrelated identity fields.';
            END IF;

            IF v_changes ? 'bank_name' THEN
                IF v_document.bank_name IS NULL
                   OR v_changes->>'bank_name'
                      IS DISTINCT FROM v_document.bank_name THEN
                    RAISE EXCEPTION
                        'Requested bank name does not match the document.';
                END IF;
            END IF;

            IF v_changes ? 'bank_account_number' THEN
                IF v_document.bank_account_number IS NULL
                   OR v_changes->>'bank_account_number'
                      IS DISTINCT FROM v_document.bank_account_number THEN
                    RAISE EXCEPTION
                        'Requested account number does not match the document.';
                END IF;
            END IF;

            IF v_changes ? 'ifsc_code' THEN
                IF v_document.ifsc_code IS NULL
                   OR v_changes->>'ifsc_code'
                      IS DISTINCT FROM v_document.ifsc_code THEN
                    RAISE EXCEPTION
                        'Requested IFSC does not match the document.';
                END IF;
            END IF;

            IF NOT (
                v_changes ? 'bank_name'
                OR v_changes ? 'bank_account_number'
                OR v_changes ? 'ifsc_code'
            ) THEN
                RAISE EXCEPTION
                    'Request contains no Bank Passbook changes.';
            END IF;

        ELSIF v_type IN (
            'aadhaar card', 'aadhar card', 'aadhaar', 'aadhar'
        ) THEN
            IF v_document.aadhaar_number IS NULL
               OR v_changes->>'aadhar_number'
                  IS DISTINCT FROM v_document.aadhaar_number THEN
                RAISE EXCEPTION
                    'Request does not match the Aadhaar number.';
            END IF;

        ELSIF v_type = 'pan card' THEN
            IF v_document.pan_number IS NULL
               OR v_changes->>'pan_number'
                  IS DISTINCT FROM v_document.pan_number THEN
                RAISE EXCEPTION
                    'Request does not match the PAN number.';
            END IF;

        ELSIF v_type = 'passport' THEN
            IF v_document.passport_number IS NULL
               OR v_changes->>'passport_number'
                  IS DISTINCT FROM v_document.passport_number THEN
                RAISE EXCEPTION
                    'Request does not match the passport number.';
            END IF;
        END IF;
    END IF;

    -- Rejection does not modify the currently approved replacement target.
    IF v_decision = 'reject' THEN
        UPDATE public.employee_documents
        SET verification_status = 'rejected',
            profile_change_approved = false,
            reviewed_by = v_user_id,
            reviewed_at = now(),
            review_notes = v_notes
        WHERE id = p_document_id
          AND verification_status IN ('pending', 'verified');

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Document could not be rejected.';
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'document_id', p_document_id,
            'decision', 'reject',
            'verification_status', 'rejected'
        );
    END IF;

    -- A sensitive document must wait until its request is approved.
    IF v_sensitive AND NOT v_profile_approved THEN
        UPDATE public.employee_documents
        SET verification_status = 'verified',
            reviewed_by = v_user_id,
            reviewed_at = now(),
            review_notes = v_notes
        WHERE id = p_document_id
          AND verification_status = 'pending';

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Document could not be verified.';
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'document_id', p_document_id,
            'decision', 'approve',
            'verification_status', 'verified',
            'message',
            'Document verified; profile request approval is still required.'
        );
    END IF;

    -- A replacement must supersede the old approved document FIRST.
    -- This prevents employee_one_document_type from being violated.
    IF v_sensitive AND v_document.previous_document_id IS NOT NULL THEN
        UPDATE public.employee_documents AS old_doc
        SET verification_status = 'superseded'
        WHERE old_doc.id = v_document.previous_document_id
          AND old_doc.employee_id = v_document.employee_id
          AND lower(trim(old_doc.document_type)) = v_type
          AND lower(trim(old_doc.verification_status)) = 'approved';

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Previous approved document not found for this employee and document type.';
        END IF;
    END IF;

    -- Now approve the replacement.
    UPDATE public.employee_documents
    SET verification_status = 'approved',
        profile_change_approved = CASE
            WHEN v_sensitive THEN true
            ELSE profile_change_approved
        END,
        reviewed_by = v_user_id,
        reviewed_at = now(),
        review_notes = v_notes
    WHERE id = p_document_id
      AND verification_status IN ('pending', 'verified');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Document could not be finalized.';
    END IF;

    -- Apply only explicitly requested, document-matched fields.
    IF v_sensitive THEN
        IF v_type = 'bank passbook' THEN
            UPDATE public.employees
            SET bank_name = CASE
                    WHEN v_changes ? 'bank_name'
                    THEN v_document.bank_name
                    ELSE bank_name
                END,
                bank_account_number = CASE
                    WHEN v_changes ? 'bank_account_number'
                    THEN v_document.bank_account_number
                    ELSE bank_account_number
                END,
                ifsc_code = CASE
                    WHEN v_changes ? 'ifsc_code'
                    THEN v_document.ifsc_code
                    ELSE ifsc_code
                END,
                updated_at = now()
            WHERE id = v_document.employee_id;

        ELSIF v_type IN (
            'aadhaar card', 'aadhar card', 'aadhaar', 'aadhar'
        ) THEN
            UPDATE public.employees
            SET aadhar_number = v_document.aadhaar_number,
                updated_at = now()
            WHERE id = v_document.employee_id
              AND v_changes ? 'aadhar_number';

        ELSIF v_type = 'pan card' THEN
            UPDATE public.employees
            SET pan_number = v_document.pan_number,
                updated_at = now()
            WHERE id = v_document.employee_id
              AND v_changes ? 'pan_number';

        ELSIF v_type = 'passport' THEN
            UPDATE public.employees
            SET passport_number = v_document.passport_number,
                updated_at = now()
            WHERE id = v_document.employee_id
              AND v_changes ? 'passport_number';
        END IF;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Employee record not found or no requested field was updated.';
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'document_id', p_document_id,
        'employee_id', v_document.employee_id,
        'decision', 'approve',
        'verification_status', 'approved'
    );
END;
$$;


--
-- Name: review_profile_change_request_atomic(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.review_profile_change_request_atomic(p_request_id uuid, p_decision text, p_review_notes text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
DECLARE
    v_user_id uuid;
    v_role text;
    v_decision text := lower(trim(coalesce(p_decision, '')));
    v_notes text := nullif(trim(coalesce(p_review_notes, '')), '');
    v_request public.profile_change_requests%ROWTYPE;
    v_document public.employee_documents%ROWTYPE;
    v_old_document public.employee_documents%ROWTYPE;
    v_changes jsonb;
    v_key text;
    v_column text;
    v_value jsonb;
    v_type text;
    v_updated_count integer;
    v_sensitive boolean := false;
    v_bank boolean := false;
    v_aadhaar boolean := false;
    v_pan boolean := false;
    v_passport boolean := false;
    v_document_count integer;
    v_previous_id uuid;
    v_bank_name text;
    v_account_number text;
    v_ifsc text;
    v_aadhaar_number text;
    v_pan_number text;
    v_passport_number text;
BEGIN
    IF v_decision NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Decision must be approved or rejected.';
    END IF;

    IF length(coalesce(v_notes, '')) > 2000 THEN
        RAISE EXCEPTION 'Review notes cannot exceed 2000 characters.';
    END IF;

    IF v_decision = 'rejected' AND v_notes IS NULL THEN
        RAISE EXCEPTION 'Please provide a reason for rejection.';
    END IF;

    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized.';
    END IF;

    SELECT lower(trim(p.role))
    INTO v_role
    FROM public.profiles p
    WHERE p.id = v_user_id;

    IF v_role NOT IN ('hr', 'ceo') OR v_role IS NULL THEN
        RAISE EXCEPTION 'Only HR and CEO can review profile-change requests.';
    END IF;

    SELECT *
    INTO v_request
    FROM public.profile_change_requests r
    WHERE r.id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile-change request not found.';
    END IF;

    IF lower(trim(coalesce(v_request.status, '')))
       NOT IN ('pending', 'under_review') THEN
        RAISE EXCEPTION 'This profile-change request has already been reviewed.';
    END IF;

    IF v_request.employee_id IS NULL THEN
        RAISE EXCEPTION 'The profile-change request has no employee.';
    END IF;

    v_changes := coalesce(v_request.requested_changes, '{}'::jsonb);

    IF jsonb_typeof(v_changes) <> 'object' THEN
        RAISE EXCEPTION 'Requested changes must be a JSON object.';
    END IF;

    /*
     * Validate the complete allowlist before changing anything.
     * Sensitive values are applied from matching linked documents.
     */
    FOR v_key IN SELECT jsonb_object_keys(v_changes)
    LOOP
        v_column := CASE v_key
            WHEN 'phone' THEN 'phone'
            WHEN 'date_of_birth' THEN 'date_of_birth'
            WHEN 'gender' THEN 'gender'
            WHEN 'blood_group' THEN 'blood_group'
            WHEN 'marital_status' THEN 'marital_status'
            WHEN 'permanent_address' THEN 'permanent_address'
            WHEN 'permanent_city' THEN 'permanent_city'
            WHEN 'permanent_state' THEN 'permanent_state'
            WHEN 'permanent_pincode' THEN 'permanent_pincode'
            WHEN 'communication_address' THEN 'temporary_address'
            WHEN 'communication_city' THEN 'temporary_city'
            WHEN 'communication_state' THEN 'temporary_state'
            WHEN 'communication_pincode' THEN 'temporary_pincode'
            WHEN 'emergency_contact_name' THEN 'emergency_contact_name'
            WHEN 'emergency_contact_phone' THEN 'emergency_contact_phone'
            WHEN 'emergency_contact_relation' THEN 'emergency_contact_relation'
            WHEN 'emergency_contact_2_name' THEN 'emergency_contact_name_2'
            WHEN 'emergency_contact_2_phone' THEN 'emergency_contact_phone_2'
            WHEN 'emergency_contact_2_relation' THEN 'emergency_contact_relation_2'
            WHEN 'emergency_contact_3_name' THEN 'emergency_contact_name_3'
            WHEN 'emergency_contact_3_phone' THEN 'emergency_contact_phone_3'
            WHEN 'emergency_contact_3_relation' THEN 'emergency_contact_relation_3'
            WHEN 'department_id' THEN 'department_id'
            WHEN 'designation' THEN 'designation'
            WHEN 'probation_end_date' THEN 'probation_end_date'
            WHEN 'confirmation_date' THEN 'confirmation_date'
            WHEN 'reporting_manager' THEN 'reporting_manager'
            WHEN 'work_location' THEN 'work_location'
            WHEN 'bank_name' THEN 'bank_name'
            WHEN 'bank_account_number' THEN 'bank_account_number'
            WHEN 'ifsc_code' THEN 'ifsc_code'
            WHEN 'pan_number' THEN 'pan_number'
            WHEN 'aadhar_number' THEN 'aadhar_number'
            WHEN 'aadhaar_number' THEN 'aadhar_number'
            WHEN 'passport_number' THEN 'passport_number'
            WHEN 'accessory_type' THEN 'accessory_type'
            WHEN 'accessory_serial' THEN 'accessory_serial'
            WHEN 'peripherals' THEN 'peripherals'
            ELSE NULL
        END;

        IF v_column IS NULL THEN
            RAISE EXCEPTION 'Unsupported profile field: %', v_key;
        END IF;

        IF v_key IN (
            'bank_name', 'bank_account_number', 'ifsc_code',
            'pan_number', 'aadhar_number', 'aadhaar_number',
            'passport_number'
        ) THEN
            v_sensitive := true;
        END IF;
    END LOOP;

    /*
     * Rejection: reject eligible linked sensitive documents only.
     * Employee values and previous approved documents are untouched.
     */
    IF v_decision = 'rejected' THEN
        UPDATE public.employee_documents d
        SET verification_status = 'rejected',
            profile_change_approved = false,
            reviewed_by = v_user_id,
            reviewed_at = now(),
            review_notes = v_notes
        WHERE d.employee_id = v_request.employee_id
          AND d.profile_change_request_id = p_request_id
          AND lower(trim(coalesce(d.document_type, ''))) IN (
              'aadhaar card', 'aadhar card', 'aadhaar', 'aadhar',
              'pan card', 'passport', 'bank passbook'
          )
          AND d.verification_status IN ('pending', 'verified');

        UPDATE public.profile_change_requests
        SET status = 'rejected',
            reviewed_by = v_user_id,
            reviewed_at = now(),
            rejection_reason = v_notes
        WHERE id = p_request_id;

        RETURN jsonb_build_object(
            'success', true,
            'request_id', p_request_id,
            'status', 'rejected'
        );
    END IF;

    /*
     * Approval: linked documents may be pending or verified.
     * Each sensitive field still requires its appropriate document.
     */
    IF v_changes ?| ARRAY['bank_name', 'bank_account_number', 'ifsc_code'] THEN
        v_bank := true;

        IF NOT EXISTS (
            SELECT 1
            FROM public.employee_documents d
            WHERE d.employee_id = v_request.employee_id
              AND d.profile_change_request_id = p_request_id
              AND lower(trim(coalesce(d.document_type, ''))) = 'bank passbook'
              AND d.verification_status IN ('pending', 'verified')
        ) THEN
            RAISE EXCEPTION 'Bank-field changes require a linked Bank Passbook with pending or verified status.';
        END IF;
    END IF;

    IF v_changes ?| ARRAY['aadhar_number', 'aadhaar_number'] THEN
        v_aadhaar := true;

        IF NOT EXISTS (
            SELECT 1
            FROM public.employee_documents d
            WHERE d.employee_id = v_request.employee_id
              AND d.profile_change_request_id = p_request_id
              AND lower(trim(coalesce(d.document_type, '')))
                  IN ('aadhaar card', 'aadhar card', 'aadhaar', 'aadhar')
              AND d.verification_status IN ('pending', 'verified')
        ) THEN
            RAISE EXCEPTION 'Aadhaar changes require a linked Aadhaar document with pending or verified status.';
        END IF;
    END IF;

    IF v_changes ? 'pan_number' THEN
        v_pan := true;

        IF NOT EXISTS (
            SELECT 1
            FROM public.employee_documents d
            WHERE d.employee_id = v_request.employee_id
              AND d.profile_change_request_id = p_request_id
              AND lower(trim(coalesce(d.document_type, ''))) = 'pan card'
              AND d.verification_status IN ('pending', 'verified')
        ) THEN
            RAISE EXCEPTION 'PAN changes require a linked PAN Card with pending or verified status.';
        END IF;
    END IF;

    IF v_changes ? 'passport_number' THEN
        v_passport := true;

        IF NOT EXISTS (
            SELECT 1
            FROM public.employee_documents d
            WHERE d.employee_id = v_request.employee_id
              AND d.profile_change_request_id = p_request_id
              AND lower(trim(coalesce(d.document_type, ''))) = 'passport'
              AND d.verification_status IN ('pending', 'verified')
        ) THEN
            RAISE EXCEPTION 'Passport changes require a linked Passport with pending or verified status.';
        END IF;
    END IF;

    /*
     * Lock and validate linked sensitive documents.
     * Document values must match the values requested for approval.
     */
    FOR v_document IN
        SELECT *
        FROM public.employee_documents d
        WHERE d.employee_id = v_request.employee_id
          AND d.profile_change_request_id = p_request_id
          AND lower(trim(coalesce(d.document_type, ''))) IN (
              'aadhaar card', 'aadhar card', 'aadhaar', 'aadhar',
              'pan card', 'passport', 'bank passbook'
          )
        FOR UPDATE
    LOOP
        IF v_document.verification_status NOT IN ('pending', 'verified') THEN
            RAISE EXCEPTION
                'Supporting document "%" is not eligible for approval.',
                v_document.document_type;
        END IF;

        v_type := lower(trim(v_document.document_type));

        IF v_type = 'bank passbook' THEN
            IF v_changes ?| ARRAY[
                'aadhar_number', 'aadhaar_number', 'pan_number', 'passport_number'
            ] THEN
                RAISE EXCEPTION 'Bank Passbook cannot verify identity-number changes.';
            END IF;

            IF v_changes ? 'bank_name'
               AND (v_document.bank_name IS NULL
                    OR v_changes->>'bank_name' IS DISTINCT FROM v_document.bank_name) THEN
                RAISE EXCEPTION 'Requested bank name does not match the linked document.';
            END IF;

            IF v_changes ? 'bank_account_number'
               AND (v_document.bank_account_number IS NULL
                    OR v_changes->>'bank_account_number'
                       IS DISTINCT FROM v_document.bank_account_number) THEN
                RAISE EXCEPTION 'Requested account number does not match the linked document.';
            END IF;

            IF v_changes ? 'ifsc_code'
               AND (v_document.ifsc_code IS NULL
                    OR v_changes->>'ifsc_code' IS DISTINCT FROM v_document.ifsc_code) THEN
                RAISE EXCEPTION 'Requested IFSC does not match the linked document.';
            END IF;

            IF NOT (v_changes ?| ARRAY[
                'bank_name', 'bank_account_number', 'ifsc_code'
            ]) THEN
                RAISE EXCEPTION 'Bank Passbook is not linked to a requested bank-field change.';
            END IF;

        ELSIF v_type IN ('aadhaar card', 'aadhar card', 'aadhaar', 'aadhar') THEN
            IF NOT (v_changes ? 'aadhar_number' OR v_changes ? 'aadhaar_number')
               OR v_document.aadhaar_number IS NULL
               OR coalesce(v_changes->>'aadhar_number', v_changes->>'aadhaar_number')
                  IS DISTINCT FROM v_document.aadhaar_number THEN
                RAISE EXCEPTION 'Request does not match the linked Aadhaar number.';
            END IF;

        ELSIF v_type = 'pan card' THEN
            IF NOT (v_changes ? 'pan_number')
               OR v_document.pan_number IS NULL
               OR v_changes->>'pan_number' IS DISTINCT FROM v_document.pan_number THEN
                RAISE EXCEPTION 'Request does not match the linked PAN number.';
            END IF;

        ELSIF v_type = 'passport' THEN
            IF NOT (v_changes ? 'passport_number')
               OR v_document.passport_number IS NULL
               OR v_changes->>'passport_number' IS DISTINCT FROM v_document.passport_number THEN
                RAISE EXCEPTION 'Request does not match the linked passport number.';
            END IF;
        END IF;
    END LOOP;

    IF v_sensitive AND NOT EXISTS (
        SELECT 1
        FROM public.employee_documents d
        WHERE d.employee_id = v_request.employee_id
          AND d.profile_change_request_id = p_request_id
          AND lower(trim(coalesce(d.document_type, ''))) IN (
              'aadhaar card', 'aadhar card', 'aadhaar', 'aadhar',
              'pan card', 'passport', 'bank passbook'
          )
          AND d.verification_status IN ('pending', 'verified')
    ) THEN
        RAISE EXCEPTION 'Sensitive profile changes require linked eligible supporting documents.';
    END IF;

    /*
     * Update ordinary allowlisted fields.
     * Sensitive fields are applied from matching linked documents below.
     */
    FOR v_key IN SELECT jsonb_object_keys(v_changes)
    LOOP
        IF v_key IN (
            'bank_name', 'bank_account_number', 'ifsc_code',
            'pan_number', 'aadhar_number', 'aadhaar_number',
            'passport_number'
        ) THEN
            CONTINUE;
        END IF;

        v_column := CASE v_key
            WHEN 'phone' THEN 'phone'
            WHEN 'date_of_birth' THEN 'date_of_birth'
            WHEN 'gender' THEN 'gender'
            WHEN 'blood_group' THEN 'blood_group'
            WHEN 'marital_status' THEN 'marital_status'
            WHEN 'permanent_address' THEN 'permanent_address'
            WHEN 'permanent_city' THEN 'permanent_city'
            WHEN 'permanent_state' THEN 'permanent_state'
            WHEN 'permanent_pincode' THEN 'permanent_pincode'
            WHEN 'communication_address' THEN 'temporary_address'
            WHEN 'communication_city' THEN 'temporary_city'
            WHEN 'communication_state' THEN 'temporary_state'
            WHEN 'communication_pincode' THEN 'temporary_pincode'
            WHEN 'emergency_contact_name' THEN 'emergency_contact_name'
            WHEN 'emergency_contact_phone' THEN 'emergency_contact_phone'
            WHEN 'emergency_contact_relation' THEN 'emergency_contact_relation'
            WHEN 'emergency_contact_2_name' THEN 'emergency_contact_name_2'
            WHEN 'emergency_contact_2_phone' THEN 'emergency_contact_phone_2'
            WHEN 'emergency_contact_2_relation' THEN 'emergency_contact_relation_2'
            WHEN 'emergency_contact_3_name' THEN 'emergency_contact_name_3'
            WHEN 'emergency_contact_3_phone' THEN 'emergency_contact_phone_3'
            WHEN 'emergency_contact_3_relation' THEN 'emergency_contact_relation_3'
            WHEN 'department_id' THEN 'department_id'
            WHEN 'designation' THEN 'designation'
            WHEN 'probation_end_date' THEN 'probation_end_date'
            WHEN 'confirmation_date' THEN 'confirmation_date'
            WHEN 'reporting_manager' THEN 'reporting_manager'
            WHEN 'work_location' THEN 'work_location'
            WHEN 'accessory_type' THEN 'accessory_type'
            WHEN 'accessory_serial' THEN 'accessory_serial'
            WHEN 'peripherals' THEN 'peripherals'
            ELSE NULL
        END;

        IF v_column IS NULL THEN
            RAISE EXCEPTION 'Unsupported profile field: %', v_key;
        END IF;

        v_value := v_changes->v_key;

        IF v_column IN ('date_of_birth', 'probation_end_date', 'confirmation_date') THEN
            EXECUTE format(
                'UPDATE public.employees SET %I = $1::date, updated_at = now() WHERE id = $2',
                v_column
            )
            USING nullif(v_value #>> '{}', '')::date, v_request.employee_id;

        ELSIF v_column = 'department_id' THEN
            EXECUTE
                'UPDATE public.employees SET department_id = $1::uuid, updated_at = now() WHERE id = $2'
            USING nullif(v_value #>> '{}', '')::uuid, v_request.employee_id;

        ELSIF v_column = 'peripherals' THEN
            EXECUTE
                'UPDATE public.employees SET peripherals = $1::jsonb, updated_at = now() WHERE id = $2'
            USING v_value, v_request.employee_id;

        ELSE
            EXECUTE format(
                'UPDATE public.employees SET %I = $1, updated_at = now() WHERE id = $2',
                v_column
            )
            USING nullif(v_value #>> '{}', ''), v_request.employee_id;
        END IF;

        GET DIAGNOSTICS v_updated_count = ROW_COUNT;

        IF v_updated_count <> 1 THEN
            RAISE EXCEPTION 'Could not update employee field: %', v_key;
        END IF;
    END LOOP;

    /*
     * Apply sensitive employee values only from matching linked documents.
     */
    IF v_bank THEN
        SELECT d.bank_name, d.bank_account_number, d.ifsc_code
        INTO v_bank_name, v_account_number, v_ifsc
        FROM public.employee_documents d
        WHERE d.employee_id = v_request.employee_id
          AND d.profile_change_request_id = p_request_id
          AND lower(trim(coalesce(d.document_type, ''))) = 'bank passbook'
          AND d.verification_status IN ('pending', 'verified')
        LIMIT 1;

        UPDATE public.employees
        SET bank_name = CASE WHEN v_changes ? 'bank_name'
                             THEN v_bank_name ELSE bank_name END,
            bank_account_number = CASE WHEN v_changes ? 'bank_account_number'
                                       THEN v_account_number ELSE bank_account_number END,
            ifsc_code = CASE WHEN v_changes ? 'ifsc_code'
                             THEN v_ifsc ELSE ifsc_code END,
            updated_at = now()
        WHERE id = v_request.employee_id;
    END IF;

    IF v_aadhaar THEN
        SELECT d.aadhaar_number
        INTO v_aadhaar_number
        FROM public.employee_documents d
        WHERE d.employee_id = v_request.employee_id
          AND d.profile_change_request_id = p_request_id
          AND lower(trim(coalesce(d.document_type, '')))
              IN ('aadhaar card', 'aadhar card', 'aadhaar', 'aadhar')
          AND d.verification_status IN ('pending', 'verified')
        LIMIT 1;

        UPDATE public.employees
        SET aadhar_number = v_aadhaar_number,
            updated_at = now()
        WHERE id = v_request.employee_id;
    END IF;

    IF v_pan THEN
        SELECT d.pan_number
        INTO v_pan_number
        FROM public.employee_documents d
        WHERE d.employee_id = v_request.employee_id
          AND d.profile_change_request_id = p_request_id
          AND lower(trim(coalesce(d.document_type, ''))) = 'pan card'
          AND d.verification_status IN ('pending', 'verified')
        LIMIT 1;

        UPDATE public.employees
        SET pan_number = v_pan_number,
            updated_at = now()
        WHERE id = v_request.employee_id;
    END IF;

    IF v_passport THEN
        SELECT d.passport_number
        INTO v_passport_number
        FROM public.employee_documents d
        WHERE d.employee_id = v_request.employee_id
          AND d.profile_change_request_id = p_request_id
          AND lower(trim(coalesce(d.document_type, ''))) = 'passport'
          AND d.verification_status IN ('pending', 'verified')
        LIMIT 1;

        UPDATE public.employees
        SET passport_number = v_passport_number,
            updated_at = now()
        WHERE id = v_request.employee_id;
    END IF;

    /*
     * Finalize linked documents. Supersede only the exact referenced
     * previously approved document.
     */
    FOR v_document IN
        SELECT *
        FROM public.employee_documents d
        WHERE d.employee_id = v_request.employee_id
          AND d.profile_change_request_id = p_request_id
          AND lower(trim(coalesce(d.document_type, ''))) IN (
              'aadhaar card', 'aadhar card', 'aadhaar', 'aadhar',
              'pan card', 'passport', 'bank passbook'
          )
        FOR UPDATE
    LOOP
        IF v_document.previous_document_id IS NOT NULL THEN
            SELECT *
            INTO v_old_document
            FROM public.employee_documents old_doc
            WHERE old_doc.id = v_document.previous_document_id
              AND old_doc.employee_id = v_document.employee_id
              AND lower(trim(coalesce(old_doc.document_type, '')))
                  = lower(trim(coalesce(v_document.document_type, '')))
              AND old_doc.verification_status = 'approved'
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION
                    'The exact previous approved document for "%" was not found.',
                    v_document.document_type;
            END IF;

            UPDATE public.employee_documents
            SET verification_status = 'superseded',
                reviewed_by = v_user_id,
                reviewed_at = now()
            WHERE id = v_old_document.id
              AND verification_status = 'approved';

            IF NOT FOUND THEN
                RAISE EXCEPTION 'The previous document could not be superseded.';
            END IF;
        END IF;

        UPDATE public.employee_documents
        SET verification_status = 'approved',
            profile_change_approved = true,
            reviewed_by = v_user_id,
            reviewed_at = now(),
            review_notes = coalesce(v_notes, review_notes)
        WHERE id = v_document.id
          AND verification_status IN ('pending', 'verified');

        IF NOT FOUND THEN
            RAISE EXCEPTION 'A supporting document could not be finalized.';
        END IF;
    END LOOP;

    UPDATE public.profile_change_requests
    SET status = 'approved',
        reviewed_by = v_user_id,
        reviewed_at = now(),
        rejection_reason = NULL
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'status', 'approved'
    );
END;
$_$;


--
-- Name: update_leave_type_balances(uuid, integer, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_leave_type_balances(p_leave_type_id uuid, p_year integer, p_new_quota numeric) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.employee_leave_balances
  SET
    allocated_days = p_new_quota,
    balance_days = GREATEST(
      p_new_quota - COALESCE(used_days, 0),
      0
    )
  WHERE leave_type_id = p_leave_type_id
    AND year = p_year;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: verify_employee_document(uuid, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_employee_document(p_document_id uuid, p_action text, p_reviewed_by uuid, p_review_notes text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_doc public.employee_documents%ROWTYPE;
  v_old public.employee_documents%ROWTYPE;
BEGIN
  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid action';
  END IF;

  SELECT *
  INTO v_doc
  FROM public.employee_documents
  WHERE id = p_document_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  IF v_doc.verification_status <> 'pending' THEN
    RAISE EXCEPTION 'Document is not pending verification';
  END IF;

  IF p_action = 'reject' THEN
    UPDATE public.employee_documents
    SET verification_status = 'rejected',
        reviewed_by = p_reviewed_by,
        reviewed_at = NOW(),
        review_notes = p_review_notes
    WHERE id = p_document_id;

    RETURN jsonb_build_object(
      'employee_id', v_doc.employee_id,
      'verification_status', 'rejected'
    );
  END IF;

  IF v_doc.previous_document_id IS NOT NULL THEN
    SELECT *
    INTO v_old
    FROM public.employee_documents
    WHERE id = v_doc.previous_document_id
      AND employee_id = v_doc.employee_id
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.employee_documents
      SET verification_status = 'superseded'
      WHERE id = v_old.id
        AND verification_status = 'approved';
    END IF;
  END IF;

  UPDATE public.employee_documents
  SET verification_status = 'approved',
      reviewed_by = p_reviewed_by,
      reviewed_at = NOW(),
      review_notes = p_review_notes
  WHERE id = p_document_id;

  IF lower(trim(v_doc.document_type)) IN ('aadhar card', 'aadhaar card') THEN
    UPDATE public.employees
    SET aadhar_number = v_doc.aadhaar_number
    WHERE id = v_doc.employee_id;
  ELSIF lower(trim(v_doc.document_type)) = 'pan card' THEN
    UPDATE public.employees
    SET pan_number = v_doc.pan_number
    WHERE id = v_doc.employee_id;
  ELSIF lower(trim(v_doc.document_type)) = 'passport' THEN
    UPDATE public.employees
    SET passport_number = v_doc.passport_number
    WHERE id = v_doc.employee_id;
  ELSIF lower(trim(v_doc.document_type)) = 'bank passbook' THEN
    -- Bank values must be stored on the pending document
    -- before this approval branch can update the employee.
    RAISE EXCEPTION
      'Bank passbook approval requires bank fields on the document record';
  END IF;

  RETURN jsonb_build_object(
    'employee_id', v_doc.employee_id,
    'verification_status', 'approved'
  );
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: attendance_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid,
    attendance_date date NOT NULL,
    check_in_time timestamp with time zone,
    check_out_time timestamp with time zone,
    total_hours numeric(4,2),
    status text DEFAULT 'present'::text,
    is_late boolean DEFAULT false,
    is_regularized boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT attendance_logs_status_check CHECK ((status = ANY (ARRAY['present'::text, 'half_day'::text, 'absent'::text, 'on_leave'::text, 'holiday'::text, 'weekend'::text])))
);


--
-- Name: attendance_regularizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_regularizations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid,
    attendance_date date NOT NULL,
    proposed_check_in time without time zone NOT NULL,
    proposed_check_out time without time zone NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'pending'::text,
    rejection_reason text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT attendance_regularizations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: employee_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_documents (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid,
    document_type text NOT NULL,
    document_name text NOT NULL,
    document_url text NOT NULL,
    cloudinary_public_id text,
    uploaded_at timestamp with time zone DEFAULT now(),
    cloudinary_resource_type text,
    aadhaar_number text,
    pan_number text,
    passport_number text,
    verification_status text DEFAULT 'approved'::text NOT NULL,
    previous_document_id uuid,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    bank_name text,
    bank_account_number text,
    ifsc_code text,
    profile_change_request_id uuid,
    profile_change_approved boolean DEFAULT false NOT NULL,
    CONSTRAINT employee_documents_verification_status_check CHECK ((verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'approved'::text, 'rejected'::text, 'superseded'::text])))
);


--
-- Name: employee_leave_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_leave_balances (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid,
    leave_type_id uuid,
    year integer NOT NULL,
    allocated_days numeric(4,1) NOT NULL,
    used_days numeric(4,1) DEFAULT 0,
    balance_days numeric(4,1) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: employee_salary_components; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_salary_components (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    salary_component_id uuid NOT NULL,
    calculation_type text NOT NULL,
    value numeric(12,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    gratuity_5_year_taken boolean DEFAULT false NOT NULL,
    gratuity_5_year_taken_date date,
    gratuity_5_year_amount numeric(12,2) DEFAULT 0,
    gratuity_10_year_taken boolean DEFAULT false NOT NULL,
    gratuity_10_year_taken_date date,
    gratuity_10_year_amount numeric(12,2) DEFAULT 0,
    affects_lop boolean DEFAULT false NOT NULL,
    CONSTRAINT employee_salary_components_calculation_type_check CHECK ((calculation_type = ANY (ARRAY['fixed'::text, 'percentage_of_basic'::text, 'percentage_of_gross'::text, 'percentage_of_ctc'::text])))
);


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    employee_id text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    phone text,
    date_of_birth date,
    gender text,
    blood_group text,
    marital_status text,
    address text,
    city text,
    state text,
    pincode text,
    emergency_contact_name text,
    emergency_contact_phone text,
    emergency_contact_relation text,
    department_id uuid,
    project_id uuid,
    designation text,
    employment_type text,
    joining_date date,
    probation_end_date date,
    confirmation_date date,
    reporting_manager text,
    work_location text,
    salary numeric(12,2) DEFAULT 50000.00,
    bank_name text,
    bank_account_number text,
    ifsc_code text,
    pan_number text,
    aadhar_number text,
    esi_number text,
    profile_photo_url text,
    status text DEFAULT 'active'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    exit_reason text,
    exit_document_url text,
    exit_document_name text,
    exit_date date,
    esi_healthcare_eligible boolean DEFAULT false,
    pf_eligible boolean DEFAULT false,
    pt_eligible boolean DEFAULT false,
    pt_number text,
    tds_eligible boolean DEFAULT false,
    client_type text,
    company_name text,
    temporary_login_expires_at timestamp with time zone,
    probation_duration integer DEFAULT 6,
    permanent_address text,
    permanent_city text,
    permanent_state text,
    permanent_pincode text,
    temporary_address text,
    temporary_city text,
    temporary_state text,
    temporary_pincode text,
    esi_eligible boolean DEFAULT false,
    uan_number text,
    temporary_login_days integer,
    passport_number text,
    appointment_date date,
    emergency_contact_name_2 text,
    emergency_contact_phone_2 text,
    emergency_contact_relation_2 text,
    emergency_contact_name_3 text,
    emergency_contact_phone_3 text,
    emergency_contact_relation_3 text,
    accessory_type text,
    accessory_serial text,
    peripherals jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT employees_employment_type_check CHECK ((employment_type = ANY (ARRAY['full-time'::text, 'part-time'::text, 'contract'::text, 'intern'::text]))),
    CONSTRAINT employees_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text]))),
    CONSTRAINT employees_marital_status_check CHECK ((marital_status = ANY (ARRAY['single'::text, 'married'::text, 'divorced'::text, 'widowed'::text]))),
    CONSTRAINT employees_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'terminated'::text, 'resigned'::text, 'laid_off'::text, 'on_notice'::text]))),
    CONSTRAINT temporary_login_days_limit CHECK (((temporary_login_days IS NULL) OR ((temporary_login_days >= 0) AND (temporary_login_days <= 45))))
);


--
-- Name: holiday_calendars; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.holiday_calendars (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    country_code text NOT NULL,
    country_name text NOT NULL,
    timezone text DEFAULT 'Asia/Kolkata'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: holidays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.holidays (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    calendar_id uuid,
    holiday_date date NOT NULL,
    title text NOT NULL,
    is_optional boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    is_working_day boolean DEFAULT false NOT NULL
);


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_requests (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid,
    leave_type_id uuid,
    start_date date NOT NULL,
    end_date date NOT NULL,
    total_days numeric(4,1) NOT NULL,
    is_half_day boolean DEFAULT false,
    reason text,
    status text DEFAULT 'pending'::text,
    rejection_reason text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT leave_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])))
);


--
-- Name: leave_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_types (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    annual_quota integer DEFAULT 12,
    is_paid boolean DEFAULT true,
    is_active boolean DEFAULT true,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: payslips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payslips (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid,
    payroll_month integer NOT NULL,
    payroll_year integer NOT NULL,
    month_name text NOT NULL,
    working_days integer NOT NULL,
    present_days numeric(4,1) NOT NULL,
    paid_leaves numeric(4,1) DEFAULT 0,
    lop_days numeric(4,1) DEFAULT 0,
    gross_salary numeric(12,2) NOT NULL,
    lop_deduction numeric(12,2) DEFAULT 0,
    total_earnings numeric(12,2) NOT NULL,
    total_deductions numeric(12,2) NOT NULL,
    net_salary numeric(12,2) NOT NULL,
    earnings_breakup jsonb NOT NULL,
    deductions_breakup jsonb NOT NULL,
    payment_status text DEFAULT 'processed'::text,
    created_at timestamp with time zone DEFAULT now(),
    employer_pf numeric(12,2) DEFAULT 0 NOT NULL,
    gratuity_provision numeric(12,2) DEFAULT 0 NOT NULL,
    incentive numeric(12,2) DEFAULT 0 NOT NULL,
    bonus numeric(12,2) DEFAULT 0 NOT NULL,
    compensation numeric(12,2) DEFAULT 0 NOT NULL,
    CONSTRAINT payslips_payment_status_check CHECK ((payment_status = ANY (ARRAY['draft'::text, 'processed'::text, 'paid'::text])))
);


--
-- Name: profile_change_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_change_requests (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid,
    requested_changes jsonb NOT NULL,
    previous_values jsonb,
    status text DEFAULT 'pending'::text,
    rejection_reason text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT profile_change_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    role text DEFAULT 'employee'::text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['ceo'::text, 'hr'::text, 'employee'::text])))
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    client_country text DEFAULT 'India'::text NOT NULL,
    timezone text DEFAULT 'Asia/Kolkata'::text NOT NULL,
    calendar_id uuid,
    shift_start_time time without time zone DEFAULT '09:00:00'::time without time zone NOT NULL,
    shift_end_time time without time zone DEFAULT '18:00:00'::time without time zone NOT NULL,
    grace_period_minutes integer DEFAULT 30,
    half_day_cutoff_minutes integer DEFAULT 150,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: salary_components; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salary_components (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    type text NOT NULL,
    calculation_type text NOT NULL,
    value numeric(10,2) NOT NULL,
    affects_lop boolean DEFAULT true,
    is_active boolean DEFAULT true,
    is_statutory boolean DEFAULT false,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT salary_components_calculation_type_check CHECK ((calculation_type = ANY (ARRAY['fixed'::text, 'percentage_of_basic'::text, 'percentage_of_gross'::text]))),
    CONSTRAINT salary_components_type_check CHECK ((type = ANY (ARRAY['earning'::text, 'deduction'::text])))
);


--
-- Name: attendance_logs attendance_logs_employee_id_attendance_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_logs
    ADD CONSTRAINT attendance_logs_employee_id_attendance_date_key UNIQUE (employee_id, attendance_date);


--
-- Name: attendance_logs attendance_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_logs
    ADD CONSTRAINT attendance_logs_pkey PRIMARY KEY (id);


--
-- Name: attendance_regularizations attendance_regularizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_regularizations
    ADD CONSTRAINT attendance_regularizations_pkey PRIMARY KEY (id);


--
-- Name: departments departments_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_name_key UNIQUE (name);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: employee_documents employee_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_pkey PRIMARY KEY (id);


--
-- Name: employee_leave_balances employee_leave_balances_employee_id_leave_type_id_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_employee_id_leave_type_id_year_key UNIQUE (employee_id, leave_type_id, year);


--
-- Name: employee_leave_balances employee_leave_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_pkey PRIMARY KEY (id);


--
-- Name: employee_salary_components employee_salary_components_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_salary_components
    ADD CONSTRAINT employee_salary_components_pkey PRIMARY KEY (id);


--
-- Name: employee_salary_components employee_salary_components_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_salary_components
    ADD CONSTRAINT employee_salary_components_unique UNIQUE (employee_id, salary_component_id);


--
-- Name: employees employees_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_email_key UNIQUE (email);


--
-- Name: employees employees_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_employee_id_key UNIQUE (employee_id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: employees employees_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_user_id_key UNIQUE (user_id);


--
-- Name: holiday_calendars holiday_calendars_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holiday_calendars
    ADD CONSTRAINT holiday_calendars_pkey PRIMARY KEY (id);


--
-- Name: holidays holidays_calendar_id_holiday_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_calendar_id_holiday_date_key UNIQUE (calendar_id, holiday_date);


--
-- Name: holidays holidays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: leave_types leave_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_code_key UNIQUE (code);


--
-- Name: leave_types leave_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id);


--
-- Name: payslips payslips_employee_id_payroll_month_payroll_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_employee_id_payroll_month_payroll_year_key UNIQUE (employee_id, payroll_month, payroll_year);


--
-- Name: payslips payslips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_pkey PRIMARY KEY (id);


--
-- Name: profile_change_requests profile_change_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_change_requests
    ADD CONSTRAINT profile_change_requests_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: salary_components salary_components_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_components
    ADD CONSTRAINT salary_components_code_key UNIQUE (code);


--
-- Name: salary_components salary_components_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_components
    ADD CONSTRAINT salary_components_pkey PRIMARY KEY (id);


--
-- Name: employee_documents_employee_type_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employee_documents_employee_type_status_idx ON public.employee_documents USING btree (employee_id, document_type, verification_status);


--
-- Name: employee_one_document_type; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employee_one_document_type ON public.employee_documents USING btree (employee_id, document_type) WHERE ((verification_status = 'approved'::text) AND (document_type <> ALL (ARRAY['Experience Letter'::text, 'Other'::text])));


--
-- Name: employee_one_pending_document_type; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employee_one_pending_document_type ON public.employee_documents USING btree (employee_id, document_type) WHERE ((verification_status = 'pending'::text) AND (document_type <> ALL (ARRAY['Experience Letter'::text, 'Other'::text])));


--
-- Name: idx_employee_documents_pending_review; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_documents_pending_review ON public.employee_documents USING btree (verification_status, uploaded_at);


--
-- Name: idx_employee_documents_pending_verification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_documents_pending_verification ON public.employee_documents USING btree (verification_status, uploaded_at DESC);


--
-- Name: idx_employee_documents_review; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_documents_review ON public.employee_documents USING btree (verification_status, uploaded_at);


--
-- Name: employees update_employees_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: attendance_logs attendance_logs_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_logs
    ADD CONSTRAINT attendance_logs_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: attendance_regularizations attendance_regularizations_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_regularizations
    ADD CONSTRAINT attendance_regularizations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: attendance_regularizations attendance_regularizations_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_regularizations
    ADD CONSTRAINT attendance_regularizations_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);


--
-- Name: employee_documents employee_documents_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_documents employee_documents_previous_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_previous_document_id_fkey FOREIGN KEY (previous_document_id) REFERENCES public.employee_documents(id);


--
-- Name: employee_documents employee_documents_profile_change_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_profile_change_request_id_fkey FOREIGN KEY (profile_change_request_id) REFERENCES public.profile_change_requests(id) ON DELETE SET NULL;


--
-- Name: employee_documents employee_documents_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);


--
-- Name: employee_leave_balances employee_leave_balances_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_leave_balances employee_leave_balances_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id) ON DELETE CASCADE;


--
-- Name: employee_salary_components employee_salary_components_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_salary_components
    ADD CONSTRAINT employee_salary_components_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_salary_components employee_salary_components_salary_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_salary_components
    ADD CONSTRAINT employee_salary_components_salary_component_id_fkey FOREIGN KEY (salary_component_id) REFERENCES public.salary_components(id) ON DELETE CASCADE;


--
-- Name: employees employees_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: employees employees_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: employees employees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: holidays holidays_calendar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_calendar_id_fkey FOREIGN KEY (calendar_id) REFERENCES public.holiday_calendars(id) ON DELETE CASCADE;


--
-- Name: leave_requests leave_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: leave_requests leave_requests_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id) ON DELETE CASCADE;


--
-- Name: leave_requests leave_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);


--
-- Name: payslips payslips_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: profile_change_requests profile_change_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_change_requests
    ADD CONSTRAINT profile_change_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: profile_change_requests profile_change_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_change_requests
    ADD CONSTRAINT profile_change_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: projects projects_calendar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_calendar_id_fkey FOREIGN KEY (calendar_id) REFERENCES public.holiday_calendars(id);


--
-- Name: departments Allow authenticated read departments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read departments" ON public.departments FOR SELECT TO authenticated USING (true);


--
-- Name: holiday_calendars Allow authenticated read holiday_calendars; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read holiday_calendars" ON public.holiday_calendars FOR SELECT TO authenticated USING (true);


--
-- Name: holidays Allow authenticated read holidays; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read holidays" ON public.holidays FOR SELECT TO authenticated USING (true);


--
-- Name: leave_types Allow authenticated read leave_types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read leave_types" ON public.leave_types FOR SELECT TO authenticated USING (true);


--
-- Name: profiles Allow authenticated read profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: projects Allow authenticated read projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read projects" ON public.projects FOR SELECT TO authenticated USING (true);


--
-- Name: salary_components Allow authenticated read salary_components; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read salary_components" ON public.salary_components FOR SELECT TO authenticated USING (true);


--
-- Name: attendance_logs Attendance insert policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Attendance insert policy" ON public.attendance_logs FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: attendance_logs Attendance select policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Attendance select policy" ON public.attendance_logs FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = attendance_logs.employee_id) AND (employees.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['ceo'::text, 'hr'::text])))))));


--
-- Name: attendance_logs Attendance update policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Attendance update policy" ON public.attendance_logs FOR UPDATE TO authenticated USING (true);


--
-- Name: employee_documents Employees can insert own documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can insert own documents" ON public.employee_documents FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = employee_documents.employee_id) AND (employees.user_id = auth.uid())))));


--
-- Name: employee_documents Employees can update own documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can update own documents" ON public.employee_documents FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = employee_documents.employee_id) AND (employees.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = employee_documents.employee_id) AND (employees.user_id = auth.uid())))));


--
-- Name: employee_documents Employees can view own documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can view own documents" ON public.employee_documents FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = employee_documents.employee_id) AND (employees.user_id = auth.uid())))));


--
-- Name: employees Employees insert policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees insert policy" ON public.employees FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['ceo'::text, 'hr'::text]))))));


--
-- Name: employees Employees select policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees select policy" ON public.employees FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['ceo'::text, 'hr'::text])))))));


--
-- Name: employees Employees update policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees update policy" ON public.employees FOR UPDATE TO authenticated USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['ceo'::text, 'hr'::text]))))))) WITH CHECK (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['ceo'::text, 'hr'::text])))))));


--
-- Name: employee_salary_components Employees view own salary components; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees view own salary components" ON public.employee_salary_components FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employees e
  WHERE ((e.id = employee_salary_components.employee_id) AND (e.user_id = auth.uid())))));


--
-- Name: employee_documents HR and CEO can delete employee documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "HR and CEO can delete employee documents" ON public.employee_documents FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['hr'::text, 'ceo'::text]))))));


--
-- Name: employee_documents HR and CEO can insert employee documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "HR and CEO can insert employee documents" ON public.employee_documents FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['hr'::text, 'ceo'::text]))))));


--
-- Name: employee_documents HR and CEO can update employee documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "HR and CEO can update employee documents" ON public.employee_documents FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['hr'::text, 'ceo'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['hr'::text, 'ceo'::text]))))));


--
-- Name: employee_documents HR and CEO can view employee documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "HR and CEO can view employee documents" ON public.employee_documents FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['hr'::text, 'ceo'::text]))))));


--
-- Name: profile_change_requests HR and CEO can view profile change requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "HR and CEO can view profile change requests" ON public.profile_change_requests FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (lower(TRIM(BOTH FROM p.role)) = ANY (ARRAY['hr'::text, 'ceo'::text]))))));


--
-- Name: employee_salary_components HR and CEO manage employee salary components; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "HR and CEO manage employee salary components" ON public.employee_salary_components TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['hr'::text, 'ceo'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['hr'::text, 'ceo'::text]))))));


--
-- Name: payslips Payslips select policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Payslips select policy" ON public.payslips FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = payslips.employee_id) AND (employees.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['ceo'::text, 'hr'::text])))))));


--
-- Name: attendance_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_regularizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance_regularizations ENABLE ROW LEVEL SECURITY;

--
-- Name: departments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_leave_balances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_leave_balances ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_salary_components; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_salary_components ENABLE ROW LEVEL SECURITY;

--
-- Name: employees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

--
-- Name: holiday_calendars; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.holiday_calendars ENABLE ROW LEVEL SECURITY;

--
-- Name: holidays; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

--
-- Name: leave_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: leave_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;

--
-- Name: payslips; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

--
-- Name: profile_change_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profile_change_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: salary_components; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.salary_components ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict dJScbzaL2r0jxFv7fEsfSJNm6w31W0jw4xweTI05Os74ikcOXhxPcUQOTaa7a6z

