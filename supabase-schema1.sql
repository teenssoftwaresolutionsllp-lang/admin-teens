--
-- PostgreSQL database dump
--

\restrict nMZMTqhOd6jfFZ14hA72R1VbzusOf1NjmAODxsjGToK3Fjkmy5C9LMtgm69GmE5

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
-- Name: begin_candidate_onboarding_link_generation(uuid, uuid, uuid, text, timestamp with time zone, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.begin_candidate_onboarding_link_generation(p_candidate_id uuid, p_submission_id uuid, p_lock_id uuid, p_token_hash text, p_expires_at timestamp with time zone, p_created_by uuid) RETURNS TABLE(previous_token_id uuid, new_token_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_current_submission_id UUID;
    v_locked_candidate_id UUID;
    v_previous_token_id UUID;
    v_new_token_id UUID;
BEGIN
    -- Confirm the candidate still points to this submission.
    SELECT c.onboarding_submission_id
    INTO v_current_submission_id
    FROM public.joining_candidates c
    WHERE c.id = p_candidate_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Candidate not found';
    END IF;

    IF v_current_submission_id IS DISTINCT FROM p_submission_id THEN
        RAISE EXCEPTION 'Onboarding submission has changed';
    END IF;

    -- Claim a 10-minute generation lock.
    INSERT INTO public.joining_onboarding_link_locks AS existing_lock
        (candidate_id, lock_id, locked_until)
    VALUES
        (p_candidate_id, p_lock_id, NOW() + INTERVAL '10 minutes')
    ON CONFLICT (candidate_id)
    DO UPDATE SET
        lock_id = EXCLUDED.lock_id,
        locked_until = EXCLUDED.locked_until
    WHERE existing_lock.locked_until <= NOW()
    RETURNING candidate_id INTO v_locked_candidate_id;

    IF v_locked_candidate_id IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '55P03',
            MESSAGE = 'An onboarding link is being generated concurrently. Please refresh and try again.';
    END IF;

    -- Revoke the previous active token.
    UPDATE public.joining_onboarding_tokens
    SET revoked_at = NOW()
    WHERE candidate_id = p_candidate_id
      AND used_at IS NULL
      AND revoked_at IS NULL
    RETURNING id INTO v_previous_token_id;

    -- Insert the replacement token.
    INSERT INTO public.joining_onboarding_tokens (
        candidate_id,
        submission_id,
        token_hash,
        expires_at,
        created_by
    )
    VALUES (
        p_candidate_id,
        p_submission_id,
        p_token_hash,
        p_expires_at,
        p_created_by
    )
    RETURNING id INTO v_new_token_id;

    RETURN QUERY
    SELECT v_previous_token_id, v_new_token_id;
END;
$$;


--
-- Name: claim_joining_letter_send(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_joining_letter_send(p_candidate_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_candidate public.joining_candidates%ROWTYPE;
  v_submission public.joining_onboarding_submissions%ROWTYPE;
  v_offer public.joining_documents%ROWTYPE;

  v_education jsonb;
  v_employment_history jsonb;
  v_highest_qualification text;

  v_required_documents text[] := ARRAY[
    'aadhaar_card',
    'pan_card',
    'driving_license',
    'passport_photo',
    'bank_account_proof',
    'education_10th'
  ];

  v_has_new_education boolean := false;
  v_has_12th boolean := false;
  v_has_graduation boolean := false;
  v_has_postgraduation boolean := false;
  v_has_other boolean := false;

  v_is_experienced boolean := false;
  v_invalid_chain boolean := false;
  v_missing_documents boolean := false;

BEGIN
  /*
   * 1. Lock candidate.
   */
  SELECT *
  INTO v_candidate
  FROM public.joining_candidates
  WHERE id = p_candidate_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  /*
   * 2. Validate candidate state.
   */
  IF v_candidate.status IS DISTINCT FROM 'offer_accepted'
     OR v_candidate.onboarding_status IS DISTINCT FROM 'submitted'
     OR v_candidate.onboarding_submission_id IS NULL
     OR v_candidate.employee_record_id IS NOT NULL
     OR COALESCE(v_candidate.conversion_status, 'not_started')
          IN ('processing', 'completed')
     OR v_candidate.joining_letter_sent_at IS NOT NULL
     OR v_candidate.joining_letter_send_status
          NOT IN ('not_started', 'failed')
  THEN
    RETURN false;
  END IF;

  /*
   * 3. Lock active submitted onboarding version.
   */
  SELECT *
  INTO v_submission
  FROM public.joining_onboarding_submissions
  WHERE id = v_candidate.onboarding_submission_id
    AND candidate_id = v_candidate.id
    AND status = 'submitted'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  /*
   * 4. All six HR information sections must be verified.
   */
  IF LOWER(COALESCE(v_submission.personal_verification_status, ''))
       <> 'verified'
     OR LOWER(COALESCE(v_submission.address_verification_status, ''))
       <> 'verified'
     OR LOWER(COALESCE(v_submission.bank_verification_status, ''))
       <> 'verified'
     OR LOWER(COALESCE(v_submission.identity_verification_status, ''))
       <> 'verified'
     OR LOWER(COALESCE(v_submission.education_verification_status, ''))
       <> 'verified'
     OR LOWER(COALESCE(v_submission.emergency_verification_status, ''))
       <> 'verified'
  THEN
    RETURN false;
  END IF;

  /*
   * 5. Validate the exact accepted offer document.
   */
  IF v_candidate.accepted_offer_document_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT *
  INTO v_offer
  FROM public.joining_documents
  WHERE id = v_candidate.accepted_offer_document_id
    AND candidate_id = v_candidate.id
    AND document_type = 'offer_letter'
    AND sent_at IS NOT NULL;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF jsonb_typeof(v_offer.offer_snapshot)
       IS DISTINCT FROM 'object'
     OR jsonb_typeof(v_offer.offer_snapshot->'candidate')
       IS DISTINCT FROM 'object'
     OR jsonb_typeof(v_offer.offer_snapshot->'compensation')
       IS DISTINCT FROM 'object'
     OR jsonb_typeof(v_offer.offer_snapshot->'statutory')
       IS DISTINCT FROM 'object'
     OR v_offer.offer_snapshot #>> '{candidate,id}'
       IS DISTINCT FROM v_candidate.id::text
  THEN
    RETURN false;
  END IF;

  /*
   * 6. Determine experience status.
   * Explicit fresher always takes precedence.
   */
  v_is_experienced :=
    CASE
      WHEN LOWER(TRIM(COALESCE(v_candidate.experience_level, '')))
           = 'fresher'
        THEN false
      WHEN LOWER(TRIM(COALESCE(v_candidate.experience_level, '')))
           = 'experienced'
        THEN true
      ELSE
        COALESCE(v_candidate.total_experience_years, 0) > 0
        OR COALESCE(v_candidate.total_experience_months, 0) > 0
    END;

  /*
   * 7. Match getRequiredEducationDocuments() exactly.
   */
  v_education := COALESCE(
    v_submission.submission_data->'educationDetails',
    '{}'::jsonb
  );

  IF jsonb_typeof(v_education) IS DISTINCT FROM 'object' THEN
    RETURN false;
  END IF;

  -- New education form detection.
  SELECT EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      'tenthSchoolName',
      'tenthBoard',
      'tenthYearOfPassing',
      'tenthResultType',
      'tenthResult',
      'tenthResultTotal',
      'twelfthInstitution',
      'twelfthBoard',
      'twelfthStream',
      'twelfthYearOfPassing',
      'twelfthResultType',
      'twelfthResult',
      'twelfthResultTotal',
      'graduationInstitution',
      'graduationUniversity',
      'graduationCourse',
      'graduationSpecialization',
      'graduationYearOfPassing',
      'graduationResultType',
      'graduationResult',
      'graduationResultTotal',
      'postGraduationInstitution',
      'postGraduationUniversity',
      'postGraduationCourse',
      'postGraduationSpecialization',
      'postGraduationYearOfPassing',
      'postGraduationResultType',
      'postGraduationResult',
      'postGraduationResultTotal',
      'otherQualification',
      'otherInstitution',
      'otherAuthority',
      'otherYearOfPassing',
      'otherResultType',
      'otherResult',
      'otherResultTotal'
    ]) AS fields(field_name)
    WHERE jsonb_typeof(v_education->field_name) = 'string'
      AND BTRIM(v_education->>field_name) <> ''
  )
  INTO v_has_new_education;

  IF v_has_new_education THEN

    SELECT EXISTS (
      SELECT 1
      FROM unnest(ARRAY[
        'twelfthInstitution',
        'twelfthBoard',
        'twelfthStream',
        'twelfthYearOfPassing',
        'twelfthResultType',
        'twelfthResult'
      ]) AS fields(field_name)
      WHERE jsonb_typeof(v_education->field_name) = 'string'
        AND BTRIM(v_education->>field_name) <> ''
    )
    INTO v_has_12th;

    SELECT EXISTS (
      SELECT 1
      FROM unnest(ARRAY[
        'graduationInstitution',
        'graduationUniversity',
        'graduationCourse',
        'graduationSpecialization',
        'graduationYearOfPassing',
        'graduationResultType',
        'graduationResult'
      ]) AS fields(field_name)
      WHERE jsonb_typeof(v_education->field_name) = 'string'
        AND BTRIM(v_education->>field_name) <> ''
    )
    INTO v_has_graduation;

    SELECT EXISTS (
      SELECT 1
      FROM unnest(ARRAY[
        'postGraduationInstitution',
        'postGraduationUniversity',
        'postGraduationCourse',
        'postGraduationSpecialization',
        'postGraduationYearOfPassing',
        'postGraduationResultType',
        'postGraduationResult'
      ]) AS fields(field_name)
      WHERE jsonb_typeof(v_education->field_name) = 'string'
        AND BTRIM(v_education->>field_name) <> ''
    )
    INTO v_has_postgraduation;

    SELECT EXISTS (
      SELECT 1
      FROM unnest(ARRAY[
        'otherQualification',
        'otherInstitution',
        'otherAuthority',
        'otherYearOfPassing',
        'otherResultType',
        'otherResult'
      ]) AS fields(field_name)
      WHERE jsonb_typeof(v_education->field_name) = 'string'
        AND BTRIM(v_education->>field_name) <> ''
    )
    INTO v_has_other;

    IF v_has_12th OR v_has_graduation OR v_has_postgraduation THEN
      v_required_documents :=
        array_append(v_required_documents, 'education_12th');
    END IF;

    IF v_has_graduation OR v_has_postgraduation THEN
      v_required_documents :=
        array_append(v_required_documents, 'education_graduation');
    END IF;

    IF v_has_postgraduation THEN
      v_required_documents :=
        array_append(v_required_documents, 'education_post_graduation');
    END IF;

    IF v_has_other THEN
      v_required_documents :=
        array_append(v_required_documents, 'education_other');
    END IF;

  ELSE

    /*
     * Legacy form normalization:
     * trim, lowercase, replace underscores/hyphens,
     * and collapse repeated whitespace.
     */
    v_highest_qualification :=
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          LOWER(BTRIM(COALESCE(
            v_education->>'highestQualification',
            ''
          ))),
          '[_-]+',
          ' ',
          'g'
        ),
        '[[:space:]]+',
        ' ',
        'g'
      );

    IF v_highest_qualification = ''
       OR v_highest_qualification IS NULL
    THEN
      RETURN false;
    END IF;

    IF v_highest_qualification = 'other'
       OR v_highest_qualification LIKE '%other qualification%'
       OR v_highest_qualification LIKE '%not listed%'
    THEN

      v_required_documents :=
        array_append(v_required_documents, 'education_other');

    ELSIF v_highest_qualification LIKE '%10th%'
       OR v_highest_qualification LIKE '%secondary%'
       OR v_highest_qualification LIKE '%matric%'
    THEN

      NULL;

    ELSE

      v_required_documents :=
        array_append(v_required_documents, 'education_12th');

      IF v_highest_qualification LIKE '%post graduate%'
         OR v_highest_qualification LIKE '%postgraduate%'
         OR v_highest_qualification LIKE '%master%'
         OR v_highest_qualification LIKE '%mba%'
         OR v_highest_qualification LIKE '%mca%'
         OR v_highest_qualification LIKE '%m.tech%'
         OR v_highest_qualification LIKE '%mtech%'
         OR v_highest_qualification LIKE '%m.sc%'
         OR v_highest_qualification LIKE '%msc%'
         OR v_highest_qualification LIKE '%phd%'
         OR v_highest_qualification LIKE '%doctorate%'
         OR v_highest_qualification LIKE '%post graduation%'
      THEN

        v_required_documents :=
          array_append(v_required_documents, 'education_graduation');

        v_required_documents :=
          array_append(v_required_documents, 'education_post_graduation');

      ELSIF v_highest_qualification LIKE '%graduation%'
         OR v_highest_qualification LIKE '%graduate%'
         OR v_highest_qualification LIKE '%bachelor%'
         OR v_highest_qualification LIKE '%degree%'
         OR v_highest_qualification LIKE '%b.tech%'
         OR v_highest_qualification LIKE '%btech%'
         OR v_highest_qualification LIKE '%b.e.%'
         OR v_highest_qualification LIKE '%be %'
         OR v_highest_qualification LIKE '%b.com%'
         OR v_highest_qualification LIKE '%bcom%'
         OR v_highest_qualification LIKE '%b.sc%'
         OR v_highest_qualification LIKE '%bsc%'
         OR v_highest_qualification LIKE '%bca%'
         OR v_highest_qualification LIKE '%bba%'
      THEN

        v_required_documents :=
          array_append(v_required_documents, 'education_graduation');

      ELSIF v_highest_qualification LIKE '%diploma%'
         OR v_highest_qualification LIKE '%iti%'
         OR v_highest_qualification LIKE '%vocational%'
      THEN

        v_required_documents :=
          array_append(v_required_documents, 'education_other');

      ELSE
        RETURN false;
      END IF;

    END IF;
  END IF;

  /*
   * 8. Validate the complete submission ancestry.
   * Prevent broken links, cycles, and excessively deep chains.
   */
  WITH RECURSIVE submission_chain AS (
    SELECT
      s.id,
      s.candidate_id,
      s.supersedes_submission_id,
      ARRAY[s.id]::uuid[] AS path,
      0 AS depth
    FROM public.joining_onboarding_submissions s
    WHERE s.id = v_submission.id
      AND s.candidate_id = v_candidate.id

    UNION ALL

    SELECT
      previous.id,
      previous.candidate_id,
      previous.supersedes_submission_id,
      chain.path || previous.id,
      chain.depth + 1
    FROM submission_chain chain
    JOIN public.joining_onboarding_submissions previous
      ON previous.id = chain.supersedes_submission_id
     AND previous.candidate_id = chain.candidate_id
    WHERE chain.depth < 20
      AND NOT previous.id = ANY(chain.path)
  )
  SELECT EXISTS (
    SELECT 1
    FROM submission_chain chain
    WHERE (
      chain.supersedes_submission_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.joining_onboarding_submissions parent
        WHERE parent.id = chain.supersedes_submission_id
          AND parent.candidate_id = chain.candidate_id
      )
    )
    OR chain.supersedes_submission_id = ANY(chain.path)
    OR (
      chain.depth >= 20
      AND chain.supersedes_submission_id IS NOT NULL
    )
  )
  INTO v_invalid_chain;

  IF v_invalid_chain THEN
    RETURN false;
  END IF;

  /*
   * 9. Check latest general document versions across
   * the entire submission ancestry.
   */
  WITH RECURSIVE submission_chain AS (
    SELECT
      s.id,
      s.candidate_id,
      s.supersedes_submission_id,
      ARRAY[s.id]::uuid[] AS path,
      0 AS depth
    FROM public.joining_onboarding_submissions s
    WHERE s.id = v_submission.id
      AND s.candidate_id = v_candidate.id

    UNION ALL

    SELECT
      previous.id,
      previous.candidate_id,
      previous.supersedes_submission_id,
      chain.path || previous.id,
      chain.depth + 1
    FROM submission_chain chain
    JOIN public.joining_onboarding_submissions previous
      ON previous.id = chain.supersedes_submission_id
     AND previous.candidate_id = chain.candidate_id
    WHERE chain.depth < 20
      AND NOT previous.id = ANY(chain.path)
  ),
  latest_documents AS (
    SELECT DISTINCT ON (
      d.document_type,
      d.employment_record_id
    )
      d.document_type,
      d.employment_record_id,
      d.verification_status,
      d.resubmission_requested_at
    FROM submission_chain chain
    JOIN public.joining_onboarding_documents d
      ON d.submission_id = chain.id
     AND d.candidate_id = chain.candidate_id
    ORDER BY
      d.document_type,
      d.employment_record_id,
      d.version DESC,
      d.uploaded_at DESC,
      d.created_at DESC,
      d.id DESC
  )
  SELECT EXISTS (
    SELECT 1
    FROM unnest(v_required_documents) AS required(document_type)
    WHERE NOT EXISTS (
      SELECT 1
      FROM latest_documents latest
      WHERE latest.document_type = required.document_type
        AND latest.employment_record_id IS NULL
        AND LOWER(COALESCE(latest.verification_status, ''))
              IN ('verified', 'approved', 'accepted')
        AND latest.resubmission_requested_at IS NULL
    )
  )
  INTO v_missing_documents;

  IF v_missing_documents THEN
    RETURN false;
  END IF;

  /*
   * 10. Experienced candidates need verified employment
   * information and two approved documents per employer.
   */
  IF v_is_experienced THEN

    v_employment_history :=
      v_submission.submission_data
        ->'previousEmploymentDetails'
        ->'employmentHistory';

    IF jsonb_typeof(v_employment_history) IS DISTINCT FROM 'array'
       OR jsonb_array_length(v_employment_history) = 0
       OR LOWER(COALESCE(
            v_submission.employment_verification_status,
            ''
          )) <> 'verified'
    THEN
      RETURN false;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_employment_history) AS employer(value)
      WHERE jsonb_typeof(employer.value) IS DISTINCT FROM 'object'
         OR COALESCE(employer.value->>'id', '')
              !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ) THEN
      RETURN false;
    END IF;

    WITH RECURSIVE submission_chain AS (
      SELECT
        s.id,
        s.candidate_id,
        s.supersedes_submission_id,
        ARRAY[s.id]::uuid[] AS path,
        0 AS depth
      FROM public.joining_onboarding_submissions s
      WHERE s.id = v_submission.id
        AND s.candidate_id = v_candidate.id

      UNION ALL

      SELECT
        previous.id,
        previous.candidate_id,
        previous.supersedes_submission_id,
        chain.path || previous.id,
        chain.depth + 1
      FROM submission_chain chain
      JOIN public.joining_onboarding_submissions previous
        ON previous.id = chain.supersedes_submission_id
       AND previous.candidate_id = chain.candidate_id
      WHERE chain.depth < 20
        AND NOT previous.id = ANY(chain.path)
    ),
    latest_documents AS (
      SELECT DISTINCT ON (
        d.document_type,
        d.employment_record_id
      )
        d.document_type,
        d.employment_record_id,
        d.verification_status,
        d.resubmission_requested_at
      FROM submission_chain chain
      JOIN public.joining_onboarding_documents d
        ON d.submission_id = chain.id
       AND d.candidate_id = chain.candidate_id
      ORDER BY
        d.document_type,
        d.employment_record_id,
        d.version DESC,
        d.uploaded_at DESC,
        d.created_at DESC,
        d.id DESC
    )
    SELECT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_employment_history) AS employer(value)
      CROSS JOIN (
        VALUES
          ('experience_document'),
          ('relieving_letter')
      ) AS required(document_type)
      WHERE NOT EXISTS (
        SELECT 1
        FROM latest_documents latest
        WHERE latest.document_type = required.document_type
          AND latest.employment_record_id::text =
                employer.value->>'id'
          AND LOWER(COALESCE(latest.verification_status, ''))
                IN ('verified', 'approved', 'accepted')
          AND latest.resubmission_requested_at IS NULL
      )
    )
    INTO v_missing_documents;

    IF v_missing_documents THEN
      RETURN false;
    END IF;

  END IF;

  /*
   * 11. All checks passed. Claim the send operation atomically.
   */
  UPDATE public.joining_candidates
  SET
    joining_letter_send_status = 'sending',
    joining_letter_send_started_at = now()
  WHERE id = v_candidate.id
    AND status = 'offer_accepted'
    AND onboarding_status = 'submitted'
    AND joining_letter_send_status IN ('not_started', 'failed')
    AND joining_letter_sent_at IS NULL
    AND employee_record_id IS NULL
    AND COALESCE(conversion_status, 'not_started')
          NOT IN ('processing', 'completed');

  RETURN FOUND;

END;
$_$;


--
-- Name: complete_candidate_onboarding_verification(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_candidate_onboarding_verification(p_candidate_id uuid, p_actor_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_candidate public.joining_candidates%ROWTYPE;
  v_claimed boolean := false;
  v_previous_send_status text;
  v_previous_send_started_at timestamptz;
  v_completed_at timestamptz;
BEGIN
  IF p_candidate_id IS NULL OR p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Candidate ID and HR user ID are required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_actor_user_id
      AND role = 'hr'
  ) THEN
    RAISE EXCEPTION 'Only an HR user can complete onboarding verification.';
  END IF;

  SELECT *
  INTO v_candidate
  FROM public.joining_candidates
  WHERE id = p_candidate_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Joining candidate not found.';
  END IF;

  IF v_candidate.onboarding_verified_at IS NOT NULL
     OR v_candidate.onboarding_verified_by IS NOT NULL
  THEN
    RAISE EXCEPTION 'Onboarding verification is already completed or partially recorded.';
  END IF;

  v_previous_send_status :=
    v_candidate.joining_letter_send_status;

  v_previous_send_started_at :=
    v_candidate.joining_letter_send_started_at;

  v_completed_at := now();

  UPDATE public.joining_candidates
  SET
    onboarding_verified_at = v_completed_at,
    onboarding_verified_by = p_actor_user_id
  WHERE id = p_candidate_id;

  v_claimed :=
    public.claim_joining_letter_send(p_candidate_id);

  IF v_claimed THEN

    UPDATE public.joining_candidates
    SET
      joining_letter_send_status = v_previous_send_status,
      joining_letter_send_started_at = v_previous_send_started_at,
      onboarding_verification_reopened_at = NULL,
      onboarding_verification_reopened_by = NULL
    WHERE id = p_candidate_id;

  ELSE

    UPDATE public.joining_candidates
    SET
      onboarding_verified_at = NULL,
      onboarding_verified_by = NULL
    WHERE id = p_candidate_id;

    RETURN false;

  END IF;

  INSERT INTO public.joining_onboarding_events (
    id,
    candidate_id,
    submission_id,
    actor_type,
    actor_user_id,
    event_type,
    event_details,
    created_at
  )
  VALUES (
    gen_random_uuid(),
    p_candidate_id,
    v_candidate.onboarding_submission_id,
    'hr',
    p_actor_user_id,
    'onboarding_verification_completed',
    jsonb_build_object(
      'verified_at', v_completed_at,
      'verified_by', p_actor_user_id,
      'validation', 'claim_joining_letter_send',
      'joining_letter_sent', false
    ),
    now()
  );

  RETURN true;
END;
$$;


--
-- Name: finalize_joining_offer_send(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finalize_joining_offer_send(p_candidate_id uuid, p_document_id uuid, p_email_provider_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_candidate public.joining_candidates%ROWTYPE;
  v_document public.joining_documents%ROWTYPE;
  v_latest_version INTEGER;

  v_accept_count INTEGER;
  v_decline_count INTEGER;
  v_updated_count INTEGER;
BEGIN
  -- Validate Resend provider ID.
  IF p_email_provider_id IS NULL
     OR length(trim(p_email_provider_id)) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'A valid email provider ID is required.'
    );
  END IF;

  -- Lock candidate first to serialize offer sending and acceptance.
  SELECT *
  INTO v_candidate
  FROM public.joining_candidates
  WHERE id = p_candidate_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Candidate not found.'
    );
  END IF;

  IF v_candidate.status NOT IN ('selected', 'offer_sent') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Candidate status no longer permits sending this offer.'
    );
  END IF;

  IF v_candidate.accepted_offer_document_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'An offer has already been accepted.'
    );
  END IF;

  -- Lock the exact offer document.
  SELECT *
  INTO v_document
  FROM public.joining_documents
  WHERE id = p_document_id
    AND candidate_id = p_candidate_id
    AND document_type = 'offer_letter'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Offer document not found.'
    );
  END IF;

  -- Require the immutable offer snapshot.
  IF v_document.offer_snapshot IS NULL
     OR jsonb_typeof(v_document.offer_snapshot) <> 'object' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Offer salary snapshot is missing.'
    );
  END IF;

  -- Only the latest offer revision may be activated.
  SELECT MAX(version)
  INTO v_latest_version
  FROM public.joining_documents
  WHERE candidate_id = p_candidate_id
    AND document_type = 'offer_letter';

  IF v_document.version IS DISTINCT FROM v_latest_version THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'A newer offer version exists. This offer cannot be activated.'
    );
  END IF;

  -- Idempotent retry if this exact document was already finalized.
  IF v_document.sent_at IS NOT NULL THEN

    SELECT
      COUNT(*) FILTER (
        WHERE action = 'accept_offer'
          AND activated_at IS NOT NULL
          AND used_at IS NULL
          AND revoked_at IS NULL
      ),
      COUNT(*) FILTER (
        WHERE action = 'decline_offer'
          AND activated_at IS NOT NULL
          AND used_at IS NULL
          AND revoked_at IS NULL
      )
    INTO v_accept_count, v_decline_count
    FROM public.joining_action_tokens
    WHERE candidate_id = p_candidate_id
      AND document_id = p_document_id;

    IF v_document.email_provider_id = p_email_provider_id
       AND v_accept_count = 1
       AND v_decline_count = 1 THEN
      RETURN jsonb_build_object(
        'success', true,
        'already_finalized', true,
        'document_id', p_document_id,
        'version', v_document.version,
        'message', 'This offer was already finalized.'
      );
    END IF;

    RETURN jsonb_build_object(
      'success', false,
      'message', 'This document has already been sent with a different or invalid send record.'
    );
  END IF;

  -- For a new send, require exactly one valid, unused,
  -- unrevoked, inactive accept token and one decline token.
  SELECT
    COUNT(*) FILTER (
      WHERE action = 'accept_offer'
        AND used_at IS NULL
        AND revoked_at IS NULL
        AND activated_at IS NULL
        AND expires_at > now()
    ),
    COUNT(*) FILTER (
      WHERE action = 'decline_offer'
        AND used_at IS NULL
        AND revoked_at IS NULL
        AND activated_at IS NULL
        AND expires_at > now()
    )
  INTO v_accept_count, v_decline_count
  FROM public.joining_action_tokens
  WHERE candidate_id = p_candidate_id
    AND document_id = p_document_id;

  IF v_accept_count <> 1 OR v_decline_count <> 1 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Exactly one valid accept token and one valid decline token are required.'
    );
  END IF;

  -- Activate both tokens for this exact offer document.
  UPDATE public.joining_action_tokens
  SET activated_at = now()
  WHERE candidate_id = p_candidate_id
    AND document_id = p_document_id
    AND action IN ('accept_offer', 'decline_offer')
    AND used_at IS NULL
    AND revoked_at IS NULL
    AND activated_at IS NULL
    AND expires_at > now();

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count <> 2 THEN
    RAISE EXCEPTION
      'Expected to activate exactly two offer response tokens; activated %.',
      v_updated_count;
  END IF;

  -- Record successful email sending.
  UPDATE public.joining_documents
  SET
    sent_at = now(),
    email_provider_id = p_email_provider_id
  WHERE id = p_document_id
    AND candidate_id = p_candidate_id
    AND sent_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unable to record offer send.';
  END IF;

  -- Revoke all other unused response links for this candidate.
  UPDATE public.joining_action_tokens
  SET revoked_at = now()
  WHERE candidate_id = p_candidate_id
    AND document_id IS DISTINCT FROM p_document_id
    AND used_at IS NULL
    AND revoked_at IS NULL;

  -- Update candidate status only after the document and tokens
  -- have been successfully finalized.
  UPDATE public.joining_candidates
  SET
    status = 'offer_sent',
    offer_sent_at = now(),
    updated_at = now()
  WHERE id = p_candidate_id
    AND status IN ('selected', 'offer_sent')
    AND accepted_offer_document_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Candidate status changed before offer finalization.';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'document_id', p_document_id,
    'version', v_document.version,
    'message', 'Offer email recorded and exactly two response tokens activated.'
  );
END;
$$;


--
-- Name: finish_candidate_onboarding_link_generation(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finish_candidate_onboarding_link_generation(p_candidate_id uuid, p_lock_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    DELETE FROM public.joining_onboarding_link_locks
    WHERE candidate_id = p_candidate_id
      AND lock_id = p_lock_id;
END;
$$;


--
-- Name: guard_accepted_offer_reference(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_accepted_offer_reference() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- An accepted offer reference can never be replaced or cleared.
  IF OLD.accepted_offer_document_id IS NOT NULL
     AND NEW.accepted_offer_document_id
         IS DISTINCT FROM OLD.accepted_offer_document_id THEN
    RAISE EXCEPTION
      'The accepted offer document reference is immutable.';
  END IF;

  -- Whenever a non-null accepted offer is assigned,
  -- verify that it belongs to this candidate and is valid.
  IF NEW.accepted_offer_document_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.joining_documents d
       WHERE d.id = NEW.accepted_offer_document_id
         AND d.candidate_id = NEW.id
         AND d.document_type = 'offer_letter'
         AND d.sent_at IS NOT NULL
         AND d.offer_snapshot IS NOT NULL
         AND jsonb_typeof(d.offer_snapshot) = 'object'
     ) THEN
    RAISE EXCEPTION
      'Accepted offer must reference a valid sent offer with a salary snapshot.';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: guard_joining_letter_hr_verification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_joining_letter_hr_verification() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.joining_letter_send_status = 'sending'
     AND (
       NEW.onboarding_verified_at IS NULL
       OR NEW.onboarding_verified_by IS NULL
     )
  THEN
    RAISE EXCEPTION
      'HR onboarding verification must be completed before generating the joining letter.';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: guard_joining_offer_document(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_joining_offer_document() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Prevent deletion of sent or accepted offer documents.
  IF TG_OP = 'DELETE' THEN
    IF OLD.document_type = 'offer_letter'
       AND (
         OLD.sent_at IS NOT NULL
         OR EXISTS (
           SELECT 1
           FROM public.joining_candidates c
           WHERE c.id = OLD.candidate_id
             AND c.accepted_offer_document_id = OLD.id
         )
       ) THEN
      RAISE EXCEPTION
        'Sent or accepted offer documents cannot be deleted.';
    END IF;

    RETURN OLD;
  END IF;

  -- Validate any newly supplied offer snapshot.
  IF NEW.document_type = 'offer_letter'
     AND NEW.offer_snapshot IS NOT NULL
     AND jsonb_typeof(NEW.offer_snapshot) <> 'object' THEN
    RAISE EXCEPTION
      'Offer snapshot must be a JSON object.';
  END IF;

  -- Once a snapshot exists, it is immutable.
  IF OLD.document_type = 'offer_letter'
     AND OLD.offer_snapshot IS NOT NULL
     AND NEW.offer_snapshot IS DISTINCT FROM OLD.offer_snapshot THEN
    RAISE EXCEPTION
      'Offer salary snapshots cannot be modified.';
  END IF;

  -- Sent offer records are immutable.
  IF OLD.document_type = 'offer_letter'
     AND OLD.sent_at IS NOT NULL
     AND (
       NEW.candidate_id IS DISTINCT FROM OLD.candidate_id
       OR NEW.document_type IS DISTINCT FROM OLD.document_type
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.sent_at IS DISTINCT FROM OLD.sent_at
       OR NEW.email_provider_id IS DISTINCT FROM OLD.email_provider_id
       OR NEW.offer_snapshot IS DISTINCT FROM OLD.offer_snapshot
     ) THEN
    RAISE EXCEPTION
      'Sent offer records cannot be modified.';
  END IF;

  RETURN NEW;
END;
$$;


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
-- Name: import_holiday_calendar(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.import_holiday_calendar(p_calendar_id uuid, p_imported_by uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_calendar RECORD;
  v_item JSONB;
  v_date DATE;
  v_title TEXT;
  v_optional BOOLEAN;
  v_working_day BOOLEAN;
  v_conflicts JSONB := '[]'::JSONB;
  v_count INTEGER := 0;
BEGIN
  -- Lock the calendar so two imports cannot run simultaneously.
  SELECT id, calendar_year, document_status, extracted_holidays
  INTO v_calendar
  FROM public.holiday_calendars
  WHERE id = p_calendar_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Holiday calendar not found';
  END IF;

  IF v_calendar.document_status <> 'extracted' THEN
    RAISE EXCEPTION 'Calendar must have extracted status before import';
  END IF;

  IF jsonb_typeof(v_calendar.extracted_holidays) <> 'array'
     OR jsonb_array_length(v_calendar.extracted_holidays) = 0 THEN
    RAISE EXCEPTION 'No extracted holidays available to import';
  END IF;

  IF jsonb_array_length(v_calendar.extracted_holidays) > 500 THEN
    RAISE EXCEPTION 'Maximum 500 holiday entries allowed';
  END IF;

  -- Validate every extracted entry.
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(v_calendar.extracted_holidays)
  LOOP
    IF COALESCE(v_item->>'holiday_date', '') !~ '^\d{4}-\d{2}-\d{2}$' THEN
      RAISE EXCEPTION 'Invalid holiday date format';
    END IF;

    BEGIN
      v_date := (v_item->>'holiday_date')::DATE;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid holiday date: %', v_item->>'holiday_date';
    END;

    IF EXTRACT(YEAR FROM v_date)::INTEGER <> v_calendar.calendar_year THEN
      RAISE EXCEPTION 'Holiday date does not match calendar year: %', v_date;
    END IF;

    IF COALESCE(length(trim(v_item->>'title')), 0) = 0
       OR length(trim(v_item->>'title')) > 150 THEN
      RAISE EXCEPTION 'Holiday title must contain 1 to 150 characters';
    END IF;

    IF (v_item ? 'is_optional')
       AND jsonb_typeof(v_item->'is_optional') <> 'boolean' THEN
      RAISE EXCEPTION 'Invalid optional flag';
    END IF;

    IF (v_item ? 'is_working_day')
       AND jsonb_typeof(v_item->'is_working_day') <> 'boolean' THEN
      RAISE EXCEPTION 'Invalid working-day flag';
    END IF;
  END LOOP;

  -- Reject duplicate dates inside the extracted document.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_calendar.extracted_holidays) AS e(value)
    GROUP BY e.value->>'holiday_date'
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Extracted document contains duplicate holiday dates';
  END IF;

  -- Find dates that already exist. Never overwrite manual entries.
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'holiday_date', h.holiday_date,
        'existing_title', h.title,
        'extracted_title', e.value->>'title'
      )
    ),
    '[]'::JSONB
  )
  INTO v_conflicts
  FROM jsonb_array_elements(v_calendar.extracted_holidays) AS e(value)
  JOIN public.holidays h
    ON h.calendar_id = p_calendar_id
   AND h.holiday_date = (e.value->>'holiday_date')::DATE;

  IF jsonb_array_length(v_conflicts) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'conflicts', v_conflicts,
      'message', 'Some dates already exist. Resolve conflicts before importing.'
    );
  END IF;

  -- Insert all entries. Any failure rolls back the entire transaction.
  INSERT INTO public.holidays (
    calendar_id,
    holiday_date,
    title,
    is_optional,
    is_working_day
  )
  SELECT
    p_calendar_id,
    (value->>'holiday_date')::DATE,
    trim(value->>'title'),
    COALESCE((value->>'is_optional')::BOOLEAN, false),
    COALESCE((value->>'is_working_day')::BOOLEAN, false)
  FROM jsonb_array_elements(v_calendar.extracted_holidays);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.holiday_calendars
  SET
    document_status = 'imported',
    imported_at = NOW(),
    imported_by = p_imported_by
  WHERE id = p_calendar_id;

  RETURN jsonb_build_object(
    'success', true,
    'imported_count', v_count,
    'message', 'Holiday calendar imported successfully'
  );
END;
$_$;


--
-- Name: import_holiday_calendar_with_edits(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.import_holiday_calendar_with_edits(p_calendar_id uuid, p_imported_by uuid, p_holidays jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_status TEXT;
  v_result JSONB;
BEGIN
  IF jsonb_typeof(p_holidays) <> 'array'
     OR jsonb_array_length(p_holidays) = 0
     OR jsonb_array_length(p_holidays) > 500 THEN
    RAISE EXCEPTION 'Provide between 1 and 500 holiday entries';
  END IF;

  SELECT document_status
  INTO v_status
  FROM public.holiday_calendars
  WHERE id = p_calendar_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Holiday calendar not found';
  END IF;

  IF v_status <> 'extracted' THEN
    RAISE EXCEPTION 'Calendar must have extracted status before import';
  END IF;

  UPDATE public.holiday_calendars
  SET extracted_holidays = p_holidays
  WHERE id = p_calendar_id;

  SELECT public.import_holiday_calendar(
    p_calendar_id,
    p_imported_by
  )
  INTO v_result;

  RETURN v_result;
END;
$$;


--
-- Name: payroll_v2_block_settlement_processing_until_payroll_link(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_block_settlement_processing_until_payroll_link() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    IF NEW.status = 'processed'
       AND OLD.status IS DISTINCT FROM 'processed'
    THEN
        RAISE EXCEPTION
            'Settlement processing is disabled until payroll-run verification is implemented.';
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: payroll_v2_cleanup_november_2026_test(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_cleanup_november_2026_test() RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    v_run_id UUID :=
        '355733b1-ddf5-4a53-8853-bf692fa13520';

    v_actor_id UUID;
    v_run public.payroll_v2_runs%ROWTYPE;
    v_existing_count INTEGER;
    v_deleted_count INTEGER;
    v_reason TEXT :=
        'Cancelled: November 2026 Payroll V2 dummy component calculation test cleanup.';
BEGIN
    -- Require a real authenticated HR/CEO session.
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION
            'Authenticated user session is required.';
    END IF;

    v_actor_id := public.payroll_v2_current_actor_id();

    -- Lock and validate the exact test run.
    SELECT *
    INTO v_run
    FROM public.payroll_v2_runs
    WHERE id = v_run_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'The specified November 2026 test run was not found.';
    END IF;

    IF v_run.payroll_year <> 2026
       OR v_run.payroll_month <> 11
       OR v_run.run_number <> 1
       OR v_run.run_type <> 'regular'
       OR v_run.status <> 'draft'
       OR v_run.reason <> 'November payroll component calculation test'
       OR v_run.employee_count <> 82
       OR v_run.config_version_id <>
          'a8fe0c56-6ee1-4f83-b486-2f87e712e065'::UUID
       OR COALESCE((v_run.calculation_snapshot ->> 'test_run')::BOOLEAN, FALSE)
          IS NOT TRUE
    THEN
        RAISE EXCEPTION
            'Run validation failed. No records were changed.';
    END IF;

    -- Require exactly the expected number of generated employee rows.
    SELECT COUNT(*)::INTEGER
    INTO v_existing_count
    FROM public.payroll_v2_employee_payrolls
    WHERE payroll_run_id = v_run_id;

    IF v_existing_count <> 82 THEN
        RAISE EXCEPTION
            'Expected 82 employee payroll rows, found %. No records were changed.',
            v_existing_count;
    END IF;

    -- Remove only this draft test run's employee payroll rows.
    DELETE FROM public.payroll_v2_employee_payrolls
    WHERE payroll_run_id = v_run_id;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    IF v_deleted_count <> 82 THEN
        RAISE EXCEPTION
            'Expected to delete 82 rows, deleted %. Transaction rolled back.',
            v_deleted_count;
    END IF;

    -- Cancel the run. Existing triggers record the authenticated actor
    -- and append the immutable run_cancelled audit event.
    UPDATE public.payroll_v2_runs
    SET
        status = 'cancelled',
        cancelled_by = v_actor_id,
        cancelled_at = NOW(),
        cancellation_reason = v_reason
    WHERE id = v_run_id
      AND status = 'draft';

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Run cancellation failed. Transaction rolled back.';
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'run_id', v_run_id,
        'status', 'cancelled',
        'deleted_employee_payroll_rows', v_deleted_count,
        'cancelled_by', v_actor_id,
        'cancellation_reason', v_reason
    );
END;
$$;


--
-- Name: payroll_v2_current_actor_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_current_actor_id() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_actor_id UUID;
    v_configured_actor TEXT;
    v_role TEXT;
BEGIN
    v_configured_actor :=
        NULLIF(current_setting('app.actor_id', true), '');

    IF auth.uid() IS NOT NULL THEN
        v_actor_id := auth.uid();

        IF v_configured_actor IS NOT NULL
           AND v_configured_actor <> v_actor_id::TEXT THEN
            RAISE EXCEPTION
                'Configured audit actor does not match the authenticated user.';
        END IF;
    ELSE
        IF v_configured_actor IS NULL THEN
            RAISE EXCEPTION
                'Payroll operation rejected: verified actor context is missing.';
        END IF;

        BEGIN
            v_actor_id := v_configured_actor::UUID;
        EXCEPTION
            WHEN invalid_text_representation THEN
                RAISE EXCEPTION
                    'Payroll operation rejected: invalid actor ID.';
        END;
    END IF;

    SELECT p.role
    INTO v_role
    FROM public.profiles p
    WHERE p.id = v_actor_id;

    IF NOT FOUND OR v_role NOT IN ('hr', 'ceo') THEN
        RAISE EXCEPTION
            'Payroll operation rejected: actor must have HR or CEO permissions.';
    END IF;

    RETURN v_actor_id;
END;
$$;


--
-- Name: payroll_v2_generate_monthly_source_batches(integer, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_generate_monthly_source_batches(p_payroll_year integer, p_payroll_month integer, p_calendar_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_actor uuid;
    v_start date;
    v_end date;
    v_today date;
    v_timezone text;
    v_attendance_batch uuid;
    v_leave_batch uuid;
    v_lop_batch uuid;
    v_revision integer;
    v_assignment_count integer;
    v_attendance_count integer := 0;
    v_leave_count integer := 0;
    v_lop_count integer := 0;
BEGIN
    IF NOT public.payroll_v2_is_hr_or_ceo() THEN
        RAISE EXCEPTION 'Only HR or CEO can generate payroll snapshots';
    END IF;

    IF p_payroll_year NOT BETWEEN 2000 AND 2100
       OR p_payroll_month NOT BETWEEN 1 AND 12 THEN
        RAISE EXCEPTION 'Invalid payroll year or month';
    END IF;

    v_actor := public.payroll_v2_current_actor_id();

    SELECT timezone
    INTO v_timezone
    FROM public.holiday_calendars
    WHERE id = p_calendar_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid holiday calendar';
    END IF;

    v_timezone := COALESCE(v_timezone, 'Asia/Kolkata');
    v_start := make_date(p_payroll_year, p_payroll_month, 1);
    v_end := (v_start + interval '1 month - 1 day')::date;
    v_today := (now() AT TIME ZONE v_timezone)::date;

    -- Do not generate payroll snapshots from draft salary assignments.
    SELECT COUNT(*)
    INTO v_assignment_count
    FROM public.payroll_v2_employee_assignments a
    JOIN public.employees e ON e.id = a.employee_id
    WHERE a.status = 'approved'
      AND a.effective_from <= v_end
      AND (a.effective_to IS NULL OR a.effective_to >= v_start)
      AND e.status IN ('active', 'on_notice');

    IF v_assignment_count = 0 THEN
        RAISE EXCEPTION
            'No approved effective salary assignments exist for this payroll period. Draft assignments cannot be used.';
    END IF;

    -- Require an approved assignment for every employee included.
    IF EXISTS (
        SELECT 1
        FROM public.employees e
        WHERE e.status IN ('active', 'on_notice')
          AND e.joining_date <= v_end
          AND NOT EXISTS (
              SELECT 1
              FROM public.payroll_v2_employee_assignments a
              WHERE a.employee_id = e.id
                AND a.status = 'approved'
                AND a.effective_from <= v_end
                AND (a.effective_to IS NULL OR a.effective_to >= v_start)
          )
    ) THEN
        RAISE EXCEPTION
            'Some active employees do not have an approved effective salary assignment. Resolve assignments before generating snapshots.';
    END IF;

    -- Revision is shared across the three snapshot batches.
    SELECT GREATEST(
        COALESCE((SELECT MAX(revision_no)
            FROM public.payroll_v2_attendance_batches
            WHERE payroll_year = p_payroll_year
              AND payroll_month = p_payroll_month), 0),
        COALESCE((SELECT MAX(revision_no)
            FROM public.payroll_v2_leave_batches
            WHERE payroll_year = p_payroll_year
              AND payroll_month = p_payroll_month), 0),
        COALESCE((SELECT MAX(revision_no)
            FROM public.payroll_v2_lop_batches
            WHERE payroll_year = p_payroll_year
              AND payroll_month = p_payroll_month), 0)
    ) + 1 INTO v_revision;

    INSERT INTO public.payroll_v2_attendance_batches (
        payroll_year, payroll_month, revision_no,
        calendar_id, calendar_timezone, status, created_by,
        notes
    )
    VALUES (
        p_payroll_year, p_payroll_month, v_revision,
        p_calendar_id, v_timezone, 'draft', v_actor,
        'Generated by Payroll V2 source snapshot function'
    )
    RETURNING id INTO v_attendance_batch;

    INSERT INTO public.payroll_v2_leave_batches (
        payroll_year, payroll_month, revision_no,
        status, created_by, notes
    )
    VALUES (
        p_payroll_year, p_payroll_month, v_revision,
        'draft', v_actor,
        'Generated by Payroll V2 source snapshot function'
    )
    RETURNING id INTO v_leave_batch;

    INSERT INTO public.payroll_v2_lop_batches (
        payroll_year, payroll_month, revision_no,
        status, created_by, notes
    )
    VALUES (
        p_payroll_year, p_payroll_month, v_revision,
        'draft', v_actor,
        'Generated by Payroll V2 source snapshot function'
    )
    RETURNING id INTO v_lop_batch;

    -- ATTENDANCE: one row for each employee and calendar date.
    WITH eligible AS (
        SELECT DISTINCT e.id AS employee_id,
            GREATEST(v_start, e.joining_date, a.effective_from) AS from_date,
            LEAST(v_end, COALESCE(e.exit_date, v_end),
                COALESCE(a.effective_to, v_end)) AS to_date
        FROM public.employees e
        JOIN public.payroll_v2_employee_assignments a
          ON a.employee_id = e.id
         AND a.status = 'approved'
         AND a.effective_from <= v_end
         AND (a.effective_to IS NULL OR a.effective_to >= v_start)
        WHERE e.status IN ('active', 'on_notice')
          AND e.joining_date <= v_end
    ),
    dates AS (
        SELECT employee_id, d::date AS work_date
        FROM eligible
        CROSS JOIN LATERAL generate_series(
            from_date::timestamp,
            to_date::timestamp,
            interval '1 day'
        ) d
        WHERE from_date <= to_date
    ),
    source_data AS (
        SELECT
            d.employee_id,
            d.work_date,
            a.id AS attendance_id,
            a.status AS source_status,
            a.check_in_time,
            a.check_out_time,
            a.total_hours,
            COALESCE(r.reg_count, 0) AS reg_count,
            COALESCE(r.reg_ids, ARRAY[]::uuid[]) AS reg_ids,
            r.proposed_check_in,
            r.proposed_check_out,
            h.id AS holiday_id,
            h.is_working_day AS holiday_working,
            (
                EXTRACT(ISODOW FROM d.work_date)::integer
                = ANY(COALESCE(ws.working_iso_weekdays, ARRAY[1,2,3,4,5]))
            ) AS default_workday
        FROM dates d
        LEFT JOIN public.attendance_logs a
          ON a.employee_id = d.employee_id
         AND a.attendance_date = d.work_date
        LEFT JOIN LATERAL (
            SELECT
                COUNT(*)::integer AS reg_count,
                ARRAY_AGG(ar.id) AS reg_ids,
                MIN(ar.proposed_check_in) AS proposed_check_in,
                MIN(ar.proposed_check_out) AS proposed_check_out
            FROM public.attendance_regularizations ar
            WHERE ar.employee_id = d.employee_id
              AND ar.attendance_date = d.work_date
              AND ar.status = 'approved'
        ) r ON true
        LEFT JOIN public.holidays h
          ON h.calendar_id = p_calendar_id
         AND h.holiday_date = d.work_date
        LEFT JOIN public.payroll_v2_work_schedule_settings ws
          ON ws.schedule_key = 'company_default'
    ),
    classified AS (
        SELECT *,
            CASE
                WHEN holiday_id IS NOT NULL
                    THEN COALESCE(holiday_working, false)
                ELSE default_workday
            END AS scheduled_workday,
            CASE
                WHEN reg_count > 1 THEN 'exception'
                WHEN source_status = 'absent' THEN 'absent'
                WHEN source_status = 'half_day'
                     AND check_out_time IS NULL
                     AND proposed_check_out IS NULL
                    THEN 'exception'
                WHEN source_status = 'half_day' THEN 'half_day'
                WHEN source_status = 'present'
                     AND check_out_time IS NULL
                     AND proposed_check_out IS NULL
                    THEN 'exception'
                WHEN source_status = 'present' THEN 'present'
                WHEN source_status IS NULL AND work_date > v_today
                    THEN 'not_reviewed'
                ELSE 'not_recorded'
            END AS final_status
        FROM source_data
    )
    INSERT INTO public.payroll_v2_attendance_days (
        batch_id, employee_id, attendance_date,
        source_attendance_id, source_regularization_ids,
        attendance_status, check_in, check_out, total_hours,
        is_scheduled_workday, is_holiday, is_working_day,
        holiday_id, workday_source, requires_hr_review,
        hr_review_status, hr_review_reason
    )
    SELECT
        v_attendance_batch,
        employee_id,
        work_date,
        attendance_id,
        reg_ids,
        final_status,
        CASE WHEN reg_count = 1 AND proposed_check_in IS NOT NULL
             THEN (work_date + proposed_check_in) AT TIME ZONE v_timezone
             ELSE check_in_time END,
        CASE WHEN reg_count = 1 AND proposed_check_out IS NOT NULL
             THEN (work_date + proposed_check_out) AT TIME ZONE v_timezone
             ELSE check_out_time END,
        CASE
            WHEN reg_count = 1
                 AND proposed_check_in IS NOT NULL
                 AND proposed_check_out IS NOT NULL
            THEN GREATEST(
                0,
                EXTRACT(EPOCH FROM (
                    (work_date + proposed_check_out)
                    - (work_date + proposed_check_in)
                )) / 3600
            )
            ELSE total_hours
        END,
        scheduled_workday,
        holiday_id IS NOT NULL,
        scheduled_workday,
        holiday_id,
        CASE
            WHEN holiday_id IS NOT NULL AND holiday_working
                THEN 'holiday_working'
            WHEN holiday_id IS NOT NULL
                THEN 'holiday_non_working'
            WHEN default_workday THEN 'weekday_default'
            ELSE 'weekend_default'
        END,
        (
            reg_count > 1
            OR final_status = 'exception'
            OR (
                final_status = 'not_recorded'
                AND scheduled_workday
                AND work_date <= v_today
            )
        ),
        CASE
            WHEN reg_count > 1
              OR final_status = 'exception'
              OR (
                final_status = 'not_recorded'
                AND scheduled_workday
                AND work_date <= v_today
              ) THEN 'pending'
            ELSE 'not_required'
        END,
        CASE
            WHEN reg_count > 1
                THEN 'Multiple approved regularizations for the same date'
            WHEN final_status = 'exception'
                THEN 'Incomplete attendance or missing check-out'
            WHEN final_status = 'not_recorded'
                 AND scheduled_workday
                 AND work_date <= v_today
                THEN 'No attendance record on a scheduled workday'
            ELSE NULL
        END
    FROM classified;

    GET DIAGNOSTICS v_attendance_count = ROW_COUNT;

    -- LEAVE: preserve each approved source request and each calendar date.
    INSERT INTO public.payroll_v2_leave_days (
        batch_id, employee_id, source_leave_request_id,
        source_leave_type_id, leave_type_code, leave_date,
        source_request_start_date, source_request_end_date,
        source_request_status, is_scheduled_workday,
        is_holiday, is_working_day, holiday_id,
        day_fraction, is_paid_leave, counts_toward_balance,
        requires_hr_review, review_reason
    )
    SELECT
        v_leave_batch,
        lr.employee_id,
        lr.id,
        lr.leave_type_id,
        lt.code,
        d.work_date,
        lr.start_date,
        lr.end_date,
        lr.status,
        (
            CASE WHEN h.id IS NOT NULL
                 THEN COALESCE(h.is_working_day, false)
                 ELSE EXTRACT(ISODOW FROM d.work_date)::integer
                      = ANY(COALESCE(ws.working_iso_weekdays, ARRAY[1,2,3,4,5]))
            END
        ),
        h.id IS NOT NULL,
        (
            CASE WHEN h.id IS NOT NULL
                 THEN COALESCE(h.is_working_day, false)
                 ELSE EXTRACT(ISODOW FROM d.work_date)::integer
                      = ANY(COALESCE(ws.working_iso_weekdays, ARRAY[1,2,3,4,5]))
            END
        ),
        h.id,
        CASE WHEN lr.is_half_day THEN 0.5 ELSE 1.0 END,
        COALESCE((to_jsonb(lt)->>'is_paid')::boolean, true),
        lt.code IN ('CL', 'EL', 'SL', 'ML', 'PL'),
        (
            SELECT COUNT(*) > 1
            FROM public.leave_requests other_lr
            WHERE other_lr.employee_id = lr.employee_id
              AND other_lr.status = 'approved'
              AND other_lr.start_date <= d.work_date
              AND other_lr.end_date >= d.work_date
        ),
        CASE
            WHEN (
                SELECT COUNT(*) > 1
                FROM public.leave_requests other_lr
                WHERE other_lr.employee_id = lr.employee_id
                  AND other_lr.status = 'approved'
                  AND other_lr.start_date <= d.work_date
                  AND other_lr.end_date >= d.work_date
            )
            THEN 'Overlapping approved leave requests; HR must resolve before payroll'
            ELSE NULL
        END
    FROM public.leave_requests lr
    JOIN public.leave_types lt ON lt.id = lr.leave_type_id
    CROSS JOIN LATERAL generate_series(
        GREATEST(lr.start_date, v_start)::timestamp,
        LEAST(lr.end_date, v_end)::timestamp,
        interval '1 day'
    ) d(work_date)
    LEFT JOIN public.holidays h
      ON h.calendar_id = p_calendar_id
     AND h.holiday_date = d.work_date
    LEFT JOIN public.payroll_v2_work_schedule_settings ws
      ON ws.schedule_key = 'company_default'
    WHERE lr.status = 'approved'
      AND lr.start_date <= v_end
      AND lr.end_date >= v_start
      AND EXISTS (
          SELECT 1
          FROM public.payroll_v2_employee_assignments a
          WHERE a.employee_id = lr.employee_id
            AND a.status = 'approved'
            AND a.effective_from <= d.work_date
            AND (a.effective_to IS NULL OR a.effective_to >= d.work_date)
      );

    GET DIAGNOSTICS v_leave_count = ROW_COUNT;

    -- LOP: explicit absences and approved unpaid leave.
    -- Paid leave protects the date. Overlaps remain pending for HR.
    WITH candidate_dates AS (
        SELECT
            ad.employee_id,
            ad.attendance_date AS lop_date,
            ad.source_attendance_id,
            ARRAY[]::uuid[] AS leave_ids,
            1.0::numeric AS lop_days,
            'Attendance marked absent'::text AS reason
        FROM public.payroll_v2_attendance_days ad
        WHERE ad.batch_id = v_attendance_batch
          AND ad.attendance_status = 'absent'
          AND ad.is_working_day

        UNION ALL

        SELECT
            ld.employee_id,
            ld.leave_date,
            NULL::uuid,
            ARRAY_AGG(ld.source_leave_request_id),
            MAX(ld.day_fraction),
            'Approved unpaid leave'
        FROM public.payroll_v2_leave_days ld
        WHERE ld.batch_id = v_leave_batch
          AND ld.leave_type_code = 'LOP'
          AND ld.is_working_day
        GROUP BY ld.employee_id, ld.leave_date
    ),
    grouped AS (
        SELECT
            employee_id,
            lop_date,
            (ARRAY_AGG(source_attendance_id) FILTER (WHERE source_attendance_id IS NOT NULL))[1] AS source_attendance_id,
            ARRAY(
                SELECT DISTINCT u.leave_id
                FROM candidate_dates cd
                CROSS JOIN LATERAL unnest(cd.leave_ids) AS u(leave_id)
                WHERE cd.employee_id = candidate_dates.employee_id
                  AND cd.lop_date = candidate_dates.lop_date
                  AND u.leave_id IS NOT NULL
            ) AS source_leave_ids,
            MAX(lop_days) AS lop_days,
            STRING_AGG(DISTINCT reason, '; ') AS absence_reason
        FROM candidate_dates
        GROUP BY employee_id, lop_date
    )
    INSERT INTO public.payroll_v2_lop_days (
        batch_id, employee_id, lop_date,
        source_attendance_id, source_leave_request_ids,
        lop_days, confirmation_status, absence_reason,
        requires_hr_review, hr_review_reason
    )
    SELECT
        v_lop_batch,
        g.employee_id,
        g.lop_date,
        g.source_attendance_id,
        g.source_leave_ids,        g.lop_days,
        'pending',
        g.absence_reason,
        true,
        CASE
            WHEN paid.employee_id IS NOT NULL
                THEN 'Unpaid and paid leave overlap; HR must resolve'
            WHEN overlap_check.overlap_count > 1
                THEN 'Multiple approved leave requests overlap; HR review required'
            ELSE 'Pending HR confirmation; no automatic salary deduction'
        END
    FROM grouped g
    LEFT JOIN (
        SELECT DISTINCT employee_id, leave_date
        FROM public.payroll_v2_leave_days
        WHERE batch_id = v_leave_batch
          AND is_paid_leave
    ) paid
      ON paid.employee_id = g.employee_id
     AND paid.leave_date = g.lop_date
    LEFT JOIN LATERAL (
        SELECT COUNT(*) AS overlap_count
        FROM public.payroll_v2_leave_days ld
        WHERE ld.batch_id = v_leave_batch
          AND ld.employee_id = g.employee_id
          AND ld.leave_date = g.lop_date
    ) overlap_check ON true;
    GET DIAGNOSTICS v_lop_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'attendance_batch_id', v_attendance_batch,
        'leave_batch_id', v_leave_batch,
        'lop_batch_id', v_lop_batch,
        'revision_no', v_revision,
        'attendance_rows', v_attendance_count,
        'leave_rows', v_leave_count,
        'lop_rows', v_lop_count,
        'status', 'draft'
    );
END;
$$;


--
-- Name: payroll_v2_guard_component(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_guard_component() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_actor_id UUID;
    v_is_referenced BOOLEAN;
BEGIN
    v_actor_id := public.payroll_v2_current_actor_id();

    IF TG_OP = 'DELETE' THEN
        IF EXISTS (
            SELECT 1
            FROM public.payroll_v2_config_rules
            WHERE component_id = OLD.id
        ) THEN
            RAISE EXCEPTION
                'A component referenced by payroll configuration rules cannot be deleted.';
        END IF;

        RETURN OLD;
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.created_at := now();
        NEW.updated_at := now();
        RETURN NEW;
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.code IS DISTINCT FROM OLD.code THEN
        RAISE EXCEPTION
            'Payroll component ID and code cannot be changed.';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.payroll_v2_config_rules
        WHERE component_id = OLD.id
    )
    INTO v_is_referenced;

    IF v_is_referenced
       AND (
           NEW.component_type IS DISTINCT FROM OLD.component_type
           OR NEW.is_statutory IS DISTINCT FROM OLD.is_statutory
           OR NEW.is_employee_visible IS DISTINCT FROM OLD.is_employee_visible
       ) THEN
        RAISE EXCEPTION
            'Component type, statutory classification and employee visibility cannot change after the component is referenced by a payroll rule.';
    END IF;

    NEW.updated_at := now();

    RETURN NEW;
END;
$$;


--
-- Name: payroll_v2_guard_config_rule(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_guard_config_rule() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_actor_id UUID;
    v_version_id UUID;
    v_component_id UUID;
    v_status TEXT;
BEGIN
    v_actor_id := public.payroll_v2_current_actor_id();

    IF TG_OP = 'DELETE' THEN
        v_version_id := OLD.config_version_id;
        v_component_id := OLD.component_id;
    ELSE
        v_version_id := NEW.config_version_id;
        v_component_id := NEW.component_id;
    END IF;

    IF TG_OP = 'UPDATE'
       AND (
           NEW.config_version_id IS DISTINCT FROM OLD.config_version_id
           OR NEW.component_id IS DISTINCT FROM OLD.component_id
       ) THEN
        RAISE EXCEPTION
            'A configuration rule cannot be moved to another version or component. Delete and recreate it instead.';
    END IF;

    -- Lock parent configuration first.
    SELECT status
    INTO v_status
    FROM public.payroll_v2_config_versions
    WHERE id = v_version_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'The parent payroll configuration does not exist.';
    END IF;

    IF v_status <> 'draft' THEN
        RAISE EXCEPTION
            'Configuration rules can only be inserted, updated or deleted while the parent configuration is draft. Current status: %.',
            v_status;
    END IF;

    -- Lock component to serialize rule changes against component changes.
    PERFORM 1
    FROM public.payroll_v2_components
    WHERE id = v_component_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'The referenced payroll component does not exist.';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    NEW.updated_at := now();

    RETURN NEW;
END;
$$;


--
-- Name: payroll_v2_guard_config_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_guard_config_version() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_actor_id UUID;
BEGIN
    v_actor_id := public.payroll_v2_current_actor_id();

    IF TG_OP = 'DELETE' THEN
        IF OLD.status <> 'draft' THEN
            RAISE EXCEPTION
                'Published or archived payroll configurations cannot be deleted.';
        END IF;

        RETURN OLD;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'draft' THEN
            RAISE EXCEPTION
                'A payroll configuration must be created as draft.';
        END IF;

        IF NEW.published_by IS NOT NULL
           OR NEW.published_at IS NOT NULL THEN
            RAISE EXCEPTION
                'Publication metadata cannot be supplied when creating a draft.';
        END IF;

        NEW.created_by := v_actor_id;
        NEW.created_at := now();
        NEW.updated_at := now();

        RETURN NEW;
    END IF;

    IF OLD.status = 'archived' THEN
        RAISE EXCEPTION
            'Archived payroll configurations are immutable.';
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.scope_type IS DISTINCT FROM OLD.scope_type
       OR NEW.department_id IS DISTINCT FROM OLD.department_id
       OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
       OR NEW.version_number IS DISTINCT FROM OLD.version_number
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION
            'Payroll configuration identity and creation metadata cannot be changed.';
    END IF;

    IF OLD.status = 'published' THEN
        IF NEW.status <> 'archived' THEN
            RAISE EXCEPTION
                'Published configurations may only transition to archived.';
        END IF;

        IF NEW.published_by IS DISTINCT FROM OLD.published_by
           OR NEW.published_at IS DISTINCT FROM OLD.published_at
           OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
           OR NEW.effective_to IS DISTINCT FROM OLD.effective_to
           OR NEW.notes IS DISTINCT FROM OLD.notes THEN
            RAISE EXCEPTION
                'Only the status may change when archiving a published configuration.';
        END IF;

        NEW.updated_at := now();

        RETURN NEW;
    END IF;

    IF NEW.status NOT IN ('draft', 'published') THEN
        RAISE EXCEPTION
            'Invalid payroll configuration status transition.';
    END IF;

    IF NEW.status = 'published'
       AND OLD.status = 'draft' THEN

        PERFORM public.payroll_v2_validate_config_publication(NEW.id);

        NEW.published_by := v_actor_id;
        NEW.published_at := now();
    ELSE
        IF NEW.published_by IS DISTINCT FROM OLD.published_by
           OR NEW.published_at IS DISTINCT FROM OLD.published_at THEN
            RAISE EXCEPTION
                'Publication metadata can only be set during publication.';
        END IF;
    END IF;

    NEW.updated_at := now();

    RETURN NEW;
END;
$$;


--
-- Name: payroll_v2_guard_employee_config_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_guard_employee_config_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    v_employee_payroll_id UUID;
    v_run_id UUID;
    v_run_status TEXT;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION
            'Employee configuration snapshot links cannot be updated. Replace them only while the payroll run is draft.';
    END IF;

    IF TG_OP = 'DELETE' THEN
        v_employee_payroll_id := OLD.employee_payroll_id;
    ELSE
        v_employee_payroll_id := NEW.employee_payroll_id;
    END IF;

    SELECT payroll_run_id
    INTO v_run_id
    FROM public.payroll_v2_employee_payrolls
    WHERE id = v_employee_payroll_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee payroll record does not exist.';
    END IF;

    SELECT status
    INTO v_run_status
    FROM public.payroll_v2_runs
    WHERE id = v_run_id
    FOR UPDATE;

    IF NOT FOUND OR v_run_status <> 'draft' THEN
        RAISE EXCEPTION
            'Employee configuration links can only be changed while the payroll run is draft.';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: payroll_v2_guard_employee_payroll_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_guard_employee_payroll_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    v_run_status TEXT;
    v_run_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_run_id := OLD.payroll_run_id;
    ELSE
        v_run_id := NEW.payroll_run_id;
    END IF;

    -- Prevent moving an employee record between payroll runs.
    IF TG_OP = 'UPDATE'
       AND NEW.payroll_run_id IS DISTINCT FROM OLD.payroll_run_id THEN
        RAISE EXCEPTION
            'An employee payroll record cannot be moved to another payroll run.';
    END IF;

    -- Lock the parent run to serialize changes against lifecycle transitions.
    SELECT status
    INTO v_run_status
    FROM public.payroll_v2_runs
    WHERE id = v_run_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payroll run does not exist.';
    END IF;

    -- Employee payroll rows are editable only in draft.
    IF v_run_status <> 'draft' THEN
        RAISE EXCEPTION
            'Employee payroll records can only be inserted, updated or deleted while the payroll run is in draft status. Current status: %.',
            v_run_status;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: payroll_v2_guard_leave_adjustment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_guard_leave_adjustment() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_review_status text;
    v_leave_status text;
    v_leave_employee uuid;
    v_line_count integer;
    v_invalid_count integer;
    v_ready_count integer;
BEGIN

    IF TG_OP = 'INSERT' THEN

        IF NEW.status <> 'pending_source_verification' THEN
            RAISE EXCEPTION
                'New adjustments must start in pending_source_verification.';
        END IF;

        IF NEW.target_payroll_year IS NOT NULL
           OR NEW.target_payroll_month IS NOT NULL THEN
            RAISE EXCEPTION
                'Payroll target cannot be assigned during creation.';
        END IF;

        IF NEW.reviewed_by IS NOT NULL
           OR NEW.reviewed_at IS NOT NULL THEN
            RAISE EXCEPTION
                'HR review details cannot be supplied during creation.';
        END IF;

        SELECT
            rr.review_status,
            lr.status,
            lr.employee_id
        INTO
            v_review_status,
            v_leave_status,
            v_leave_employee
        FROM public.payroll_v2_retro_leave_reviews rr
        JOIN public.leave_requests lr
          ON lr.id = rr.leave_request_id
        WHERE rr.id = NEW.retrospective_review_id
          AND rr.leave_request_id = NEW.leave_request_id;

        IF NOT FOUND
           OR v_review_status <> 'approved'
           OR v_leave_status <> 'approved'
           OR v_leave_employee IS DISTINCT FROM NEW.employee_id THEN

            RAISE EXCEPTION
                'Adjustment requires an approved retrospective review and matching approved leave request.';
        END IF;

        NEW.updated_at := now();
        RETURN NEW;
    END IF;

    -- Immutable source references.
    IF NEW.retrospective_review_id IS DISTINCT FROM OLD.retrospective_review_id
       OR NEW.leave_request_id IS DISTINCT FROM OLD.leave_request_id
       OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN

        RAISE EXCEPTION
            'Original adjustment references cannot be changed.';
    END IF;

    -- Enforce permitted status transitions.
    IF NEW.status IS DISTINCT FROM OLD.status THEN

        IF OLD.status = 'pending_source_verification'
           AND NEW.status IN ('pending_calculation', 'cancelled') THEN
            NULL;

        ELSIF OLD.status = 'pending_calculation'
           AND NEW.status IN (
               'pending_hr_review',
               'no_financial_adjustment',
               'cancelled'
           ) THEN
            NULL;

        ELSIF OLD.status = 'pending_hr_review'
           AND NEW.status IN ('approved', 'cancelled') THEN
            NULL;

        ELSIF OLD.status = 'approved'
           AND NEW.status IN ('assigned_to_payroll', 'cancelled') THEN
            NULL;

        ELSIF OLD.status = 'assigned_to_payroll'
           AND NEW.status = 'processed' THEN
            NULL;

        ELSE
            RAISE EXCEPTION
                'Invalid adjustment status transition: % -> %.',
                OLD.status,
                NEW.status;
        END IF;

        -- Allow financially ready and no-financial-impact lines together.
        IF NEW.status = 'pending_hr_review' THEN

            SELECT
                COUNT(*),
                COUNT(*) FILTER (
                    WHERE calculation_status NOT IN (
                        'ready',
                        'no_financial_impact'
                    )
                    OR (
                        calculation_status = 'ready'
                        AND (
                            source_lop_day_id IS NULL
                            OR salary_assignment_id IS NULL
                            OR original_lop_amount IS NULL
                            OR corrected_lop_amount IS NULL
                            OR adjustment_amount IS NULL
                        )
                    )
                ),
                COUNT(*) FILTER (
                    WHERE calculation_status = 'ready'
                )
            INTO
                v_line_count,
                v_invalid_count,
                v_ready_count
            FROM public.payroll_v2_leave_adjustment_lines
            WHERE adjustment_id = NEW.id;

            IF v_line_count = 0
               OR v_invalid_count > 0
               OR v_ready_count = 0 THEN

                RAISE EXCEPTION
                    'HR review requires at least one ready financial line. All other lines must be ready or have no financial impact.';
            END IF;
        END IF;

        -- No-financial-adjustment requires every line to have no impact.
        IF NEW.status = 'no_financial_adjustment' THEN

            SELECT
                COUNT(*),
                COUNT(*) FILTER (
                    WHERE calculation_status <> 'no_financial_impact'
                )
            INTO v_line_count, v_invalid_count
            FROM public.payroll_v2_leave_adjustment_lines
            WHERE adjustment_id = NEW.id;

            IF v_line_count = 0 OR v_invalid_count > 0 THEN
                RAISE EXCEPTION
                    'Every adjustment line must have no financial impact.';
            END IF;
        END IF;

        -- HR approval requires reviewer and timestamp.
        IF NEW.status = 'approved' THEN
            IF NEW.reviewed_by IS NULL
               OR NEW.reviewed_at IS NULL THEN
                RAISE EXCEPTION
                    'HR reviewer and review timestamp are required.';
            END IF;
        END IF;

        -- Target payroll period required for assignment.
        IF NEW.status = 'assigned_to_payroll' THEN
            IF NEW.target_payroll_year IS NULL
               OR NEW.target_payroll_month IS NULL THEN
                RAISE EXCEPTION
                    'Target payroll year and month are required.';
            END IF;
        END IF;

        IF NEW.status = 'processed' THEN
            IF NEW.target_payroll_year IS NULL
               OR NEW.target_payroll_month IS NULL THEN
                RAISE EXCEPTION
                    'Processed adjustment must retain its target payroll period.';
            END IF;
        END IF;

    END IF;

    -- Once assigned, target payroll period is immutable.
    IF OLD.target_payroll_year IS NOT NULL
       AND (
           NEW.target_payroll_year IS DISTINCT FROM OLD.target_payroll_year
           OR NEW.target_payroll_month IS DISTINCT FROM OLD.target_payroll_month
       ) THEN
        RAISE EXCEPTION
            'Assigned payroll period cannot be changed.';
    END IF;

    -- Once reviewed, decision fields cannot be rewritten.
    IF OLD.reviewed_at IS NOT NULL
       AND (
           NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
           OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
       ) THEN
        RAISE EXCEPTION
            'Completed HR review details cannot be changed.';
    END IF;

    NEW.updated_at := now();

    RETURN NEW;
END;
$$;


--
-- Name: payroll_v2_guard_leave_adjustment_line(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_guard_leave_adjustment_line() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_status text;
    v_employee_id uuid;
    v_leave_start date;
    v_leave_end date;

    v_lop_employee uuid;
    v_lop_date date;
    v_lop_year integer;
    v_lop_month integer;
    v_lop_status text;
    v_batch_status text;

    v_salary_employee uuid;
    v_salary_from date;
    v_salary_to date;
BEGIN

    -- DELETE protection.
    IF TG_OP = 'DELETE' THEN

        SELECT status
        INTO v_status
        FROM public.payroll_v2_leave_adjustments
        WHERE id = OLD.adjustment_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Adjustment header not found.';
        END IF;

        IF v_status NOT IN (
            'pending_source_verification',
            'pending_calculation'
        ) THEN
            RAISE EXCEPTION
                'Adjustment lines cannot be deleted after calculation review begins.';
        END IF;

        RETURN OLD;
    END IF;

    -- Lock and validate parent adjustment.
    SELECT
        a.status,
        a.employee_id,
        rr.leave_start_date,
        rr.leave_end_date
    INTO
        v_status,
        v_employee_id,
        v_leave_start,
        v_leave_end
    FROM public.payroll_v2_leave_adjustments a
    JOIN public.payroll_v2_retro_leave_reviews rr
      ON rr.id = a.retrospective_review_id
    WHERE a.id = NEW.adjustment_id
    FOR UPDATE OF a;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Adjustment header not found.';
    END IF;

    IF v_status NOT IN (
        'pending_source_verification',
        'pending_calculation'
    ) THEN
        RAISE EXCEPTION
            'Adjustment lines are frozen once HR review begins.';
    END IF;

    -- Protect line identity and original date references.
    IF TG_OP = 'UPDATE' THEN

        IF NEW.id IS DISTINCT FROM OLD.id
           OR NEW.created_at IS DISTINCT FROM OLD.created_at
           OR NEW.adjustment_id IS DISTINCT FROM OLD.adjustment_id
           OR NEW.leave_date IS DISTINCT FROM OLD.leave_date
           OR NEW.original_payroll_year IS DISTINCT FROM OLD.original_payroll_year
           OR NEW.original_payroll_month IS DISTINCT FROM OLD.original_payroll_month THEN

            RAISE EXCEPTION
                'Adjustment line identity, parent, original leave date and payroll period cannot be changed.';
        END IF;

        -- A source reference may be assigned once, but never replaced or cleared.
        IF OLD.source_lop_day_id IS NOT NULL
           AND NEW.source_lop_day_id IS DISTINCT FROM OLD.source_lop_day_id THEN

            RAISE EXCEPTION
                'Original LOP source reference cannot be changed or removed.';
        END IF;

        IF OLD.salary_assignment_id IS NOT NULL
           AND NEW.salary_assignment_id IS DISTINCT FROM OLD.salary_assignment_id THEN

            RAISE EXCEPTION
                'Original salary assignment reference cannot be changed or removed.';
        END IF;

    END IF;

    -- Validate date against approved retrospective leave period.
    IF NEW.leave_date < v_leave_start
       OR NEW.leave_date > v_leave_end THEN
        RAISE EXCEPTION
            'Adjustment date must fall within the approved retrospective leave period.';
    END IF;

    IF NEW.original_payroll_year <> EXTRACT(YEAR FROM NEW.leave_date)::integer
       OR NEW.original_payroll_month <> EXTRACT(MONTH FROM NEW.leave_date)::integer THEN
        RAISE EXCEPTION
            'Original payroll period must match the affected leave date.';
    END IF;

    -- Validate original LOP snapshot if supplied.
    IF NEW.source_lop_day_id IS NOT NULL THEN

        SELECT
            ld.employee_id,
            ld.lop_date,
            lb.payroll_year,
            lb.payroll_month,
            ld.confirmation_status,
            lb.status
        INTO
            v_lop_employee,
            v_lop_date,
            v_lop_year,
            v_lop_month,
            v_lop_status,
            v_batch_status
        FROM public.payroll_v2_lop_days ld
        JOIN public.payroll_v2_lop_batches lb
          ON lb.id = ld.batch_id
        WHERE ld.id = NEW.source_lop_day_id;

        IF NOT FOUND
           OR v_lop_employee IS DISTINCT FROM v_employee_id
           OR v_lop_date IS DISTINCT FROM NEW.leave_date
           OR v_lop_year <> NEW.original_payroll_year
           OR v_lop_month <> NEW.original_payroll_month
           OR v_lop_status <> 'confirmed'
           OR v_batch_status <> 'locked' THEN

            RAISE EXCEPTION
                'Source LOP must be a matching confirmed row in a locked original LOP batch.';
        END IF;
    END IF;

    -- Validate salary assignment against employee and date.
    IF NEW.salary_assignment_id IS NOT NULL THEN

        SELECT
            employee_id,
            effective_from,
            effective_to
        INTO
            v_salary_employee,
            v_salary_from,
            v_salary_to
        FROM public.payroll_v2_employee_assignments
        WHERE id = NEW.salary_assignment_id;

        IF NOT FOUND
           OR v_salary_employee IS DISTINCT FROM v_employee_id
           OR v_salary_from > NEW.leave_date
           OR (
               v_salary_to IS NOT NULL
               AND v_salary_to < NEW.leave_date
           ) THEN

            RAISE EXCEPTION
                'Salary assignment does not apply to this employee and leave date.';
        END IF;
    END IF;

    -- A financially ready line must have all source and calculation values.
    IF NEW.calculation_status = 'ready' THEN

        IF NEW.source_lop_day_id IS NULL
           OR NEW.salary_assignment_id IS NULL
           OR NEW.original_lop_days IS NULL
           OR NEW.corrected_lop_days IS NULL
           OR NEW.original_lop_amount IS NULL
           OR NEW.corrected_lop_amount IS NULL
           OR NEW.adjustment_amount IS NULL THEN

            RAISE EXCEPTION
                'Ready adjustment lines require complete source and calculation values.';
        END IF;

        IF NEW.adjustment_amount <>
           NEW.original_lop_amount - NEW.corrected_lop_amount THEN

            RAISE EXCEPTION
                'Adjustment amount must equal original LOP amount minus corrected LOP amount.';
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        NEW.updated_at := now();
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: payroll_v2_guard_leave_adjustment_settlement(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_guard_leave_adjustment_settlement() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    v_line RECORD;
    v_parent_status text;
    v_existing_total numeric(14,2);
    v_actor_role text;
BEGIN

    -- Validate creator identity on INSERT.
    IF TG_OP = 'INSERT' THEN

        SELECT role
        INTO v_actor_role
        FROM public.profiles
        WHERE id = NEW.created_by;

        IF v_actor_role IS NULL
           OR v_actor_role NOT IN ('hr', 'ceo')
        THEN
            RAISE EXCEPTION
                'Only an authenticated HR or CEO profile can create a settlement.';
        END IF;

        IF NEW.status <> 'pending_hr_review' THEN
            RAISE EXCEPTION
                'New settlements must start in pending_hr_review status.';
        END IF;

        IF NEW.approved_amount IS NOT NULL
           OR NEW.processed_amount IS NOT NULL
           OR NEW.reviewed_by IS NOT NULL
           OR NEW.reviewed_at IS NOT NULL
           OR NEW.processed_by IS NOT NULL
           OR NEW.processed_at IS NOT NULL
        THEN
            RAISE EXCEPTION
                'New settlements cannot contain approval or processing details.';
        END IF;

    ELSE

        -- Protect immutable settlement identity.
        IF NEW.id IS DISTINCT FROM OLD.id
           OR NEW.adjustment_id IS DISTINCT FROM OLD.adjustment_id
           OR NEW.adjustment_line_id IS DISTINCT FROM OLD.adjustment_line_id
           OR NEW.payroll_year IS DISTINCT FROM OLD.payroll_year
           OR NEW.payroll_month IS DISTINCT FROM OLD.payroll_month
           OR NEW.requested_amount IS DISTINCT FROM OLD.requested_amount
           OR NEW.created_by IS DISTINCT FROM OLD.created_by
           OR NEW.created_at IS DISTINCT FROM OLD.created_at
        THEN
            RAISE EXCEPTION
                'Settlement identity, payroll period and requested amount are immutable.';
        END IF;

        IF OLD.status IN ('processed', 'rejected', 'cancelled') THEN
            RAISE EXCEPTION
                'Processed, rejected or cancelled settlements cannot be modified.';
        END IF;

        IF OLD.status <> 'pending_hr_review'
           AND NEW.approved_amount IS DISTINCT FROM OLD.approved_amount
        THEN
            RAISE EXCEPTION
                'Approved amount cannot be changed after HR approval.';
        END IF;

        IF OLD.reviewed_at IS NOT NULL
           AND (
               NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
               OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
           )
        THEN
            RAISE EXCEPTION
                'Settlement review details are immutable.';
        END IF;

        IF OLD.status = 'pending_hr_review'
           AND NEW.status NOT IN (
               'pending_hr_review',
               'approved',
               'rejected',
               'cancelled'
           )
        THEN
            RAISE EXCEPTION 'Invalid settlement status transition.';

        ELSIF OLD.status = 'approved'
           AND NEW.status NOT IN (
               'approved',
               'assigned_to_payroll',
               'cancelled'
           )
        THEN
            RAISE EXCEPTION 'Invalid settlement status transition.';

        ELSIF OLD.status = 'assigned_to_payroll'
           AND NEW.status NOT IN (
               'assigned_to_payroll',
               'processed'
           )
        THEN
            RAISE EXCEPTION 'Invalid settlement status transition.';
        END IF;

    END IF;


    -- Validate reviewer identity whenever a decision is recorded.
    IF NEW.status IN (
        'approved',
        'rejected',
        'cancelled',
        'assigned_to_payroll',
        'processed'
    ) THEN

        IF NEW.reviewed_by IS NULL OR NEW.reviewed_at IS NULL THEN
            RAISE EXCEPTION
                'HR reviewer and review timestamp are required for this decision.';
        END IF;

        SELECT role
        INTO v_actor_role
        FROM public.profiles
        WHERE id = NEW.reviewed_by;

        IF v_actor_role IS NULL
           OR v_actor_role NOT IN ('hr', 'ceo')
        THEN
            RAISE EXCEPTION
                'Settlement decisions require an HR or CEO reviewer.';
        END IF;

    END IF;


    -- Lock original adjustment line to serialize approvals.
    SELECT
        id,
        adjustment_id,
        calculation_status,
        adjustment_amount
    INTO v_line
    FROM public.payroll_v2_leave_adjustment_lines
    WHERE id = NEW.adjustment_line_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Original adjustment line was not found.';
    END IF;

    IF v_line.adjustment_id <> NEW.adjustment_id THEN
        RAISE EXCEPTION
            'Settlement adjustment and adjustment line do not match.';
    END IF;

    IF v_line.calculation_status <> 'ready'
       OR v_line.adjustment_amount IS NULL
       OR v_line.adjustment_amount = 0
    THEN
        RAISE EXCEPTION
            'Only ready adjustment lines with a non-zero financial adjustment can be settled.';
    END IF;


    -- Parent adjustment must be approved.
    SELECT status
    INTO v_parent_status
    FROM public.payroll_v2_leave_adjustments
    WHERE id = NEW.adjustment_id
    FOR SHARE;

    IF NOT FOUND OR v_parent_status <> 'approved' THEN
        RAISE EXCEPTION
            'Parent adjustment must be approved before monthly settlement.';
    END IF;


    -- Requested amount must have the correct sign and fit the original amount.
    IF NEW.requested_amount * v_line.adjustment_amount <= 0
       OR ABS(NEW.requested_amount) > ABS(v_line.adjustment_amount)
    THEN
        RAISE EXCEPTION
            'Requested amount must have the correct sign and cannot exceed the original adjustment.';
    END IF;


    -- Approved amount must be valid and within the requested amount.
    IF NEW.status IN ('approved', 'assigned_to_payroll', 'processed') THEN

        IF NEW.approved_amount IS NULL
           OR NEW.approved_amount * v_line.adjustment_amount <= 0
           OR ABS(NEW.approved_amount) > ABS(NEW.requested_amount)
        THEN
            RAISE EXCEPTION
                'Approved amount must have the correct sign and cannot exceed the requested amount.';
        END IF;

    END IF;


    -- A processed settlement must equal the FULL approved amount.
    IF NEW.status = 'processed' THEN

        IF NEW.processed_amount IS NULL
           OR NEW.processed_amount IS DISTINCT FROM NEW.approved_amount
           OR NEW.processed_by IS NULL
           OR NEW.processed_at IS NULL
        THEN
            RAISE EXCEPTION
                'A settlement can be processed only when the full approved amount is confirmed in payroll.';
        END IF;

        SELECT role
        INTO v_actor_role
        FROM public.profiles
        WHERE id = NEW.processed_by;

        IF v_actor_role IS NULL
           OR v_actor_role NOT IN ('hr', 'ceo')
        THEN
            RAISE EXCEPTION
                'Payroll processing must be recorded by an HR or CEO profile.';
        END IF;

    END IF;


    -- Cumulative approved amounts across all active settlements.
    IF NEW.status IN ('approved', 'assigned_to_payroll', 'processed') THEN

        SELECT COALESCE(SUM(ABS(approved_amount)), 0)
        INTO v_existing_total
        FROM public.payroll_v2_leave_adjustment_settlements
        WHERE adjustment_line_id = NEW.adjustment_line_id
          AND status IN ('approved', 'assigned_to_payroll', 'processed')
          AND id IS DISTINCT FROM NEW.id;

        IF v_existing_total + ABS(NEW.approved_amount)
           > ABS(v_line.adjustment_amount)
        THEN
            RAISE EXCEPTION
                'Cumulative approved settlements exceed the original adjustment. Available balance: %',
                ABS(v_line.adjustment_amount) - v_existing_total;
        END IF;

    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: payroll_v2_guard_leave_settlement_run_link(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_guard_leave_settlement_run_link() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    v_employee_id UUID;
    v_run_year INTEGER;
    v_run_month INTEGER;
    v_run_type TEXT;
    v_run_status TEXT;
BEGIN
    IF TG_OP = 'UPDATE'
       AND OLD.payroll_run_id IS NOT NULL
       AND NEW.payroll_run_id IS DISTINCT FROM OLD.payroll_run_id THEN
        RAISE EXCEPTION
            'An assigned leave settlement cannot be moved or unlinked.';
    END IF;

    IF NEW.status = 'assigned_to_payroll'
       AND NEW.payroll_run_id IS NULL THEN
        RAISE EXCEPTION
            'A payroll run must be linked before assigning the settlement.';
    END IF;

    IF NEW.payroll_run_id IS NOT NULL THEN

        IF NEW.status NOT IN (
            'assigned_to_payroll',
            'processed',
            'cancelled'
        ) THEN
            RAISE EXCEPTION
                'Invalid status for a linked settlement.';
        END IF;

        IF TG_OP = 'UPDATE'
           AND OLD.payroll_run_id IS NULL
           AND OLD.status <> 'approved' THEN
            RAISE EXCEPTION
                'Only an approved settlement can be assigned to payroll.';
        END IF;

        SELECT employee_id
        INTO v_employee_id
        FROM public.payroll_v2_leave_adjustments
        WHERE id = NEW.adjustment_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'The source leave adjustment does not exist.';
        END IF;

        SELECT
            payroll_year,
            payroll_month,
            run_type,
            status
        INTO
            v_run_year,
            v_run_month,
            v_run_type,
            v_run_status
        FROM public.payroll_v2_runs
        WHERE id = NEW.payroll_run_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'The linked payroll run does not exist.';
        END IF;

        IF v_run_type <> 'regular' THEN
            RAISE EXCEPTION
                'Retrospective leave settlements require a regular payroll run.';
        END IF;

        IF v_run_year <> NEW.payroll_year
           OR v_run_month <> NEW.payroll_month THEN
            RAISE EXCEPTION
                'Settlement month must match the payroll run month.';
        END IF;

        -- Require a draft run only when first assigning it.
        IF OLD.payroll_run_id IS NULL
           AND v_run_status <> 'draft' THEN
            RAISE EXCEPTION
                'A settlement can only be assigned to a draft payroll run.';
        END IF;

        -- The employee must exist in this payroll run.
        IF NOT EXISTS (
            SELECT 1
            FROM public.payroll_v2_employee_payrolls ep
            WHERE ep.payroll_run_id = NEW.payroll_run_id
              AND ep.employee_id = v_employee_id
        ) THEN
            RAISE EXCEPTION
                'The adjustment employee is not included in the selected payroll run.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: payroll_v2_guard_retro_leave_review(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_guard_retro_leave_review() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN

    IF TG_OP = 'INSERT' THEN

        IF NEW.review_status <> 'pending' THEN
            RAISE EXCEPTION
                'A retrospective review must start as pending.';
        END IF;

        RETURN NEW;
    END IF;

    -- Original request details cannot be changed.
    IF ROW(
        NEW.leave_request_id,
        NEW.leave_start_date,
        NEW.leave_end_date,
        NEW.request_submitted_at,
        NEW.retroactive_reason,
        NEW.created_by,
        NEW.created_at
    ) IS DISTINCT FROM ROW(
        OLD.leave_request_id,
        OLD.leave_start_date,
        OLD.leave_end_date,
        OLD.request_submitted_at,
        OLD.retroactive_reason,
        OLD.created_by,
        OLD.created_at
    ) THEN
        RAISE EXCEPTION
            'Original retrospective leave details cannot be changed.';
    END IF;

    -- Completed decisions are immutable.
    IF OLD.review_status <> 'pending' THEN
        RAISE EXCEPTION
            'A completed retrospective leave decision cannot be modified.';
    END IF;

    -- Only pending -> approved/rejected is allowed.
    IF NEW.review_status NOT IN ('pending', 'approved', 'rejected') THEN
        RAISE EXCEPTION
            'Invalid retrospective leave review transition.';
    END IF;

    RETURN NEW;

END;
$$;


--
-- Name: payroll_v2_guard_run_config_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_guard_run_config_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    v_run_id UUID;
    v_run_status TEXT;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION
            'Configuration snapshot links cannot be updated. Replace them only while the run is draft.';
    END IF;

    IF TG_OP = 'DELETE' THEN
        v_run_id := OLD.payroll_run_id;
    ELSE
        v_run_id := NEW.payroll_run_id;
    END IF;

    SELECT status
    INTO v_run_status
    FROM public.payroll_v2_runs
    WHERE id = v_run_id
    FOR UPDATE;

    IF NOT FOUND OR v_run_status <> 'draft' THEN
        RAISE EXCEPTION
            'Run configuration links can only be changed while the payroll run is draft.';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: payroll_v2_guard_run_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_guard_run_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    IF OLD.status IN ('finalized', 'cancelled') THEN
        RAISE EXCEPTION
            'Finalized or cancelled payroll runs cannot be modified or deleted.';
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.status <> 'draft' THEN
            RAISE EXCEPTION
                'Only draft payroll runs can be deleted.';
        END IF;

        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: payroll_v2_is_hr_or_ceo(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_is_hr_or_ceo() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.role IN ('hr', 'ceo')
    );
$$;


--
-- Name: payroll_v2_log_config_rule_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_log_config_rule_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_actor_id UUID;
    v_previous JSONB;
    v_new JSONB;
BEGIN
    v_actor_id := public.payroll_v2_current_actor_id();

    IF TG_OP = 'INSERT' THEN
        v_new := jsonb_build_object(
            'calculation_method', NEW.calculation_method,
            'calculation_value', NEW.calculation_value,
            'formula_config', NEW.formula_config,
            'effective_from', NEW.effective_from,
            'effective_to', NEW.effective_to,
            'is_active', NEW.is_active
        );

        INSERT INTO public.payroll_v2_config_rule_events (
            rule_id, config_version_id, component_id,
            event_type, previous_values, new_values, actor_id
        )
        VALUES (
            NEW.id, NEW.config_version_id, NEW.component_id,
            'rule_created', NULL, v_new, v_actor_id
        );

        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        v_previous := jsonb_build_object(
            'calculation_method', OLD.calculation_method,
            'calculation_value', OLD.calculation_value,
            'formula_config', OLD.formula_config,
            'effective_from', OLD.effective_from,
            'effective_to', OLD.effective_to,
            'is_active', OLD.is_active
        );

        v_new := jsonb_build_object(
            'calculation_method', NEW.calculation_method,
            'calculation_value', NEW.calculation_value,
            'formula_config', NEW.formula_config,
            'effective_from', NEW.effective_from,
            'effective_to', NEW.effective_to,
            'is_active', NEW.is_active
        );

        IF v_previous IS DISTINCT FROM v_new THEN
            INSERT INTO public.payroll_v2_config_rule_events (
                rule_id, config_version_id, component_id,
                event_type, previous_values, new_values, actor_id
            )
            VALUES (
                NEW.id, NEW.config_version_id, NEW.component_id,
                'rule_updated', v_previous, v_new, v_actor_id
            );
        END IF;

        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        v_previous := jsonb_build_object(
            'calculation_method', OLD.calculation_method,
            'calculation_value', OLD.calculation_value,
            'formula_config', OLD.formula_config,
            'effective_from', OLD.effective_from,
            'effective_to', OLD.effective_to,
            'is_active', OLD.is_active
        );

        INSERT INTO public.payroll_v2_config_rule_events (
            rule_id, config_version_id, component_id,
            event_type, previous_values, new_values, actor_id
        )
        VALUES (
            OLD.id, OLD.config_version_id, OLD.component_id,
            'rule_deleted', v_previous, NULL, v_actor_id
        );

        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;


--
-- Name: payroll_v2_log_config_version_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_log_config_version_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_actor_id UUID;
    v_event_type TEXT;
    v_previous_status TEXT;
    v_new_status TEXT;
    v_payload JSONB;
BEGIN
    v_actor_id := public.payroll_v2_current_actor_id();

    IF TG_OP = 'DELETE' THEN
        v_event_type := 'config_deleted';
        v_previous_status := OLD.status;
        v_new_status := OLD.status;

        v_payload := jsonb_build_object(
            'original_config_version_id', OLD.id,
            'scope_type', OLD.scope_type,
            'department_id', OLD.department_id,
            'employee_id', OLD.employee_id,
            'version_number', OLD.version_number,
            'effective_from', OLD.effective_from,
            'effective_to', OLD.effective_to,
            'notes', OLD.notes
        );

        INSERT INTO public.payroll_v2_config_version_events (
            config_version_id, event_type,
            previous_status, new_status,
            actor_id, event_payload
        )
        VALUES (
            NULL, v_event_type,
            v_previous_status, v_new_status,
            v_actor_id, v_payload
        );

        RETURN OLD;
    END IF;

    IF TG_OP = 'INSERT' THEN
        v_event_type := 'config_created';
        v_previous_status := NULL;
        v_new_status := NEW.status;
    ELSE
        v_previous_status := OLD.status;
        v_new_status := NEW.status;

        IF OLD.status IS DISTINCT FROM NEW.status THEN
            IF NEW.status = 'published' THEN
                v_event_type := 'config_published';
            ELSIF NEW.status = 'archived' THEN
                v_event_type := 'config_archived';
            ELSE
                RETURN NEW;
            END IF;
        ELSIF ROW(
            OLD.effective_from,
            OLD.effective_to,
            OLD.notes
        ) IS DISTINCT FROM ROW(
            NEW.effective_from,
            NEW.effective_to,
            NEW.notes
        ) THEN
            v_event_type := 'config_updated';
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    v_payload := jsonb_build_object(
        'scope_type', NEW.scope_type,
        'department_id', NEW.department_id,
        'employee_id', NEW.employee_id,
        'version_number', NEW.version_number,
        'effective_from', NEW.effective_from,
        'effective_to', NEW.effective_to,
        'notes', NEW.notes
    );

    INSERT INTO public.payroll_v2_config_version_events (
        config_version_id, event_type,
        previous_status, new_status,
        actor_id, event_payload
    )
    VALUES (
        NEW.id, v_event_type,
        v_previous_status, v_new_status,
        v_actor_id, v_payload
    );

    RETURN NEW;
END;
$$;


--
-- Name: payroll_v2_log_leave_adjustment_header_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_log_leave_adjustment_header_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_event_type text;
BEGIN

    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.payroll_v2_leave_adjustment_events (
            adjustment_id,
            event_type,
            new_status,
            event_payload,
            actor_id
        )
        VALUES (
            NEW.id,
            'adjustment_created',
            NEW.status,
            to_jsonb(NEW),
            auth.uid()
        );

        RETURN NEW;
    END IF;

    IF OLD.status IS DISTINCT FROM NEW.status THEN
        v_event_type := 'status_changed';
    ELSE
        v_event_type := 'header_updated';
    END IF;

    IF (to_jsonb(OLD) - 'updated_at')
       IS DISTINCT FROM
       (to_jsonb(NEW) - 'updated_at') THEN

        INSERT INTO public.payroll_v2_leave_adjustment_events (
            adjustment_id,
            event_type,
            previous_status,
            new_status,
            event_payload,
            actor_id
        )
        VALUES (
            NEW.id,
            v_event_type,
            OLD.status,
            NEW.status,
            jsonb_build_object(
                'before', to_jsonb(OLD),
                'after', to_jsonb(NEW)
            ),
            auth.uid()
        );
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: payroll_v2_log_leave_adjustment_line_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_log_leave_adjustment_line_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN

    IF TG_OP = 'INSERT' THEN

        INSERT INTO public.payroll_v2_leave_adjustment_events (
            adjustment_id,
            adjustment_line_id,
            event_type,
            event_payload,
            actor_id
        )
        VALUES (
            NEW.adjustment_id,
            NEW.id,
            'line_created',
            to_jsonb(NEW),
            auth.uid()
        );

        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN

        INSERT INTO public.payroll_v2_leave_adjustment_events (
            adjustment_id,
            adjustment_line_id,
            event_type,
            event_payload,
            actor_id
        )
        VALUES (
            NEW.adjustment_id,
            NEW.id,
            'line_updated',
            jsonb_build_object(
                'before', to_jsonb(OLD),
                'after', to_jsonb(NEW)
            ),
            auth.uid()
        );

        RETURN NEW;

    ELSE

        INSERT INTO public.payroll_v2_leave_adjustment_events (
            adjustment_id,
            adjustment_line_id,
            event_type,
            event_payload,
            actor_id
        )
        VALUES (
            OLD.adjustment_id,
            NULL,
            'line_deleted',
            jsonb_build_object(
                'deleted_line_id', OLD.id,
                'deleted_line', to_jsonb(OLD)
            ),
            auth.uid()
        );

        RETURN OLD;
    END IF;

END;
$$;


--
-- Name: payroll_v2_log_retro_leave_review_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_log_retro_leave_review_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN

    IF TG_OP = 'INSERT' THEN

        INSERT INTO public.payroll_v2_retro_leave_review_events (
            review_id,
            event_type,
            previous_status,
            new_status,
            actor_id,
            event_comment
        )
        VALUES (
            NEW.id,
            'submitted',
            NULL,
            NEW.review_status,
            NEW.created_by,
            NEW.retroactive_reason
        );

    ELSIF TG_OP = 'UPDATE'
       AND OLD.review_status IS DISTINCT FROM NEW.review_status THEN

        IF OLD.review_status <> 'pending' THEN
            RAISE EXCEPTION
                'A completed retrospective leave decision cannot be changed.';
        END IF;

        INSERT INTO public.payroll_v2_retro_leave_review_events (
            review_id,
            event_type,
            previous_status,
            new_status,
            actor_id,
            event_comment
        )
        VALUES (
            NEW.id,
            NEW.review_status,
            OLD.review_status,
            NEW.review_status,
            NEW.reviewed_by,
            NEW.review_comment
        );

    END IF;

    RETURN NEW;

END;
$$;


--
-- Name: payroll_v2_log_run_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_log_run_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_actor_id UUID;
    v_event_type TEXT;
    v_previous_status TEXT;
    v_new_status TEXT;
    v_payload JSONB;
BEGIN
    v_actor_id := public.payroll_v2_current_actor_id();

    IF TG_OP = 'INSERT' THEN
        v_event_type := 'run_created';
        v_previous_status := NULL;
        v_new_status := NEW.status;

        v_payload := jsonb_build_object(
            'payroll_year', NEW.payroll_year,
            'payroll_month', NEW.payroll_month,
            'run_number', NEW.run_number,
            'run_type', NEW.run_type
        );
    ELSE
        v_previous_status := OLD.status;
        v_new_status := NEW.status;

        IF OLD.status IS DISTINCT FROM NEW.status THEN
            IF NEW.status = 'cancelled' THEN
                v_event_type := 'run_cancelled';
            ELSE
                v_event_type := 'status_changed';
            END IF;
        ELSE
            v_event_type := 'run_updated';
        END IF;

        v_payload := jsonb_build_object(
            'payroll_year', NEW.payroll_year,
            'payroll_month', NEW.payroll_month,
            'run_number', NEW.run_number,
            'run_type', NEW.run_type,
            'total_gross_earnings', NEW.total_gross_earnings,
            'total_deductions', NEW.total_deductions,
            'total_adjustments', NEW.total_adjustments,
            'total_net_payable', NEW.total_net_payable,
            'reason', NEW.reason,
            'cancellation_reason', NEW.cancellation_reason,
            'reopen_reason', NEW.reopen_reason
        );
    END IF;

    INSERT INTO public.payroll_v2_run_events (
        payroll_run_id,
        event_type,
        previous_status,
        new_status,
        actor_id,
        event_payload
    )
    VALUES (
        NEW.id,
        v_event_type,
        v_previous_status,
        v_new_status,
        v_actor_id,
        v_payload
    );

    RETURN NEW;
END;
$$;


--
-- Name: payroll_v2_log_settlement_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_log_settlement_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_event_type text;
    v_previous_status text;
    v_new_status text;
    v_payload jsonb;
    v_actor_id uuid;
BEGIN

    IF TG_OP = 'INSERT' THEN

        v_event_type := 'settlement_created';
        v_previous_status := NULL;
        v_new_status := NEW.status;

        v_actor_id := NEW.created_by;

        v_payload := jsonb_build_object(
            'new_record', to_jsonb(NEW)
        );

    ELSE

        IF NEW.status IS DISTINCT FROM OLD.status THEN
            v_event_type := 'status_changed';
        ELSE
            v_event_type := 'settlement_updated';
        END IF;

        v_previous_status := OLD.status;
        v_new_status := NEW.status;

        -- Prefer the authenticated database session when available.
        v_actor_id := auth.uid();

        -- Use the verified processor for completed payroll processing.
        IF NEW.status = 'processed'
           AND OLD.status IS DISTINCT FROM 'processed'
        THEN
            v_actor_id := NEW.processed_by;

        -- Use the verified reviewer for the initial HR decision.
        ELSIF OLD.status = 'pending_hr_review'
           AND NEW.status IN ('approved', 'rejected', 'cancelled')
        THEN
            v_actor_id := COALESCE(v_actor_id, NEW.reviewed_by);
        END IF;

        v_payload := jsonb_build_object(
            'old_record', to_jsonb(OLD),
            'new_record', to_jsonb(NEW)
        );

    END IF;

    INSERT INTO public.payroll_v2_leave_adjustment_settlement_events (
        settlement_id,
        adjustment_id,
        event_type,
        previous_status,
        new_status,
        event_payload,
        actor_id
    )
    VALUES (
        NEW.id,
        NEW.adjustment_id,
        v_event_type,
        v_previous_status,
        v_new_status,
        v_payload,
        v_actor_id
    );

    RETURN NEW;
END;
$$;


--
-- Name: payroll_v2_post_leave_settlement_to_run(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_post_leave_settlement_to_run() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_employee_id UUID;
    v_employee_payroll_id UUID;
    v_actor_id UUID;
    v_amount NUMERIC(14,2);
    v_breakdown JSONB;
BEGIN
    IF NEW.status <> 'assigned_to_payroll'
       OR OLD.status = 'assigned_to_payroll' THEN
        RETURN NEW;
    END IF;

    v_actor_id := public.payroll_v2_current_actor_id();
    v_amount := NEW.approved_amount;

    IF v_amount IS NULL OR v_amount = 0 THEN
        RAISE EXCEPTION
            'An approved non-zero settlement amount is required.';
    END IF;

    SELECT employee_id
    INTO v_employee_id
    FROM public.payroll_v2_leave_adjustments
    WHERE id = NEW.adjustment_id;

    SELECT id, adjustment_breakdown
    INTO v_employee_payroll_id, v_breakdown
    FROM public.payroll_v2_employee_payrolls
    WHERE payroll_run_id = NEW.payroll_run_id
      AND employee_id = v_employee_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Employee payroll record is missing from the selected run.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_breakdown) AS item
        WHERE item->>'settlement_id' = NEW.id::TEXT
    ) THEN
        RAISE EXCEPTION
            'This settlement has already been posted to the payroll.';
    END IF;

    UPDATE public.payroll_v2_employee_payrolls
    SET
        adjustment_breakdown =
            v_breakdown || jsonb_build_array(
                jsonb_build_object(
                    'type', 'retrospective_leave_adjustment',
                    'description', 'Retrospective Leave Adjustment',
                    'settlement_id', NEW.id,
                    'adjustment_id', NEW.adjustment_id,
                    'adjustment_line_id', NEW.adjustment_line_id,
                    'amount', v_amount
                )
            ),
        adjustment_total = adjustment_total + v_amount,
        net_payable =
            gross_earnings - total_deductions
            + adjustment_total + v_amount,
        updated_at = now()
    WHERE id = v_employee_payroll_id;

    UPDATE public.payroll_v2_runs r
    SET
        total_gross_earnings = totals.gross_total,
        total_deductions = totals.deduction_total,
        total_adjustments = totals.adjustment_total,
        total_net_payable = totals.net_total
    FROM (
        SELECT
            payroll_run_id,
            COALESCE(SUM(gross_earnings), 0)::NUMERIC(16,2)
                AS gross_total,
            COALESCE(SUM(total_deductions), 0)::NUMERIC(16,2)
                AS deduction_total,
            COALESCE(SUM(adjustment_total), 0)::NUMERIC(16,2)
                AS adjustment_total,
            COALESCE(SUM(net_payable), 0)::NUMERIC(16,2)
                AS net_total
        FROM public.payroll_v2_employee_payrolls
        WHERE payroll_run_id = NEW.payroll_run_id
        GROUP BY payroll_run_id
    ) totals
    WHERE r.id = totals.payroll_run_id;

    RETURN NEW;
END;
$$;


--
-- Name: payroll_v2_prevent_adjustment_event_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_prevent_adjustment_event_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    RAISE EXCEPTION
        'Payroll adjustment audit events cannot be updated or deleted.';
END;
$$;


--
-- Name: payroll_v2_prevent_config_rule_event_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_prevent_config_rule_event_mutation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    RAISE EXCEPTION
        'Payroll configuration rule audit records are immutable and cannot be updated or deleted.';
END;
$$;


--
-- Name: payroll_v2_prevent_config_version_event_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_prevent_config_version_event_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    RAISE EXCEPTION
        'Payroll configuration audit events are immutable and cannot be modified or deleted.';
END;
$$;


--
-- Name: payroll_v2_prevent_retro_leave_event_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_prevent_retro_leave_event_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    RAISE EXCEPTION
        'Retrospective leave audit events cannot be modified or deleted.';
END;
$$;


--
-- Name: payroll_v2_prevent_run_event_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_prevent_run_event_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    RAISE EXCEPTION
        'Payroll run audit events are immutable and cannot be updated or deleted.';
END;
$$;


--
-- Name: payroll_v2_prevent_settlement_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_prevent_settlement_delete() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    RAISE EXCEPTION
        'Settlement records cannot be deleted. Use an allowed status transition instead.';
END;
$$;


--
-- Name: payroll_v2_prevent_settlement_event_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_prevent_settlement_event_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    RAISE EXCEPTION
        'Settlement audit events are immutable and cannot be changed or deleted.';
END;
$$;


--
-- Name: payroll_v2_protect_locked_batch(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_protect_locked_batch() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_actor_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status = 'locked' THEN
            RAISE EXCEPTION
                'Locked Payroll V2 batches cannot be deleted.';
        END IF;

        RETURN OLD;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.status = 'locked' THEN
            RAISE EXCEPTION
                'A Payroll V2 batch must be created as draft before it can be locked.';
        END IF;

        IF NEW.locked_by IS NOT NULL OR NEW.locked_at IS NOT NULL THEN
            RAISE EXCEPTION
                'Lock metadata cannot be supplied when creating a batch.';
        END IF;

        RETURN NEW;
    END IF;

    IF OLD.status = 'locked' THEN
        RAISE EXCEPTION
            'Locked Payroll V2 batches cannot be modified.';
    END IF;

    IF NEW.status = 'locked' THEN
        v_actor_id := public.payroll_v2_current_actor_id();
        NEW.locked_by := v_actor_id;
        NEW.locked_at := now();
    ELSE
        IF NEW.locked_by IS DISTINCT FROM OLD.locked_by
           OR NEW.locked_at IS DISTINCT FROM OLD.locked_at THEN
            RAISE EXCEPTION
                'Batch lock metadata can only be set during locking.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: payroll_v2_protect_locked_snapshot_rows(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_protect_locked_snapshot_rows() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $_$
DECLARE
    parent_batch_id uuid;
    parent_status text;
BEGIN
    IF TG_OP = 'UPDATE'
       AND OLD.batch_id IS DISTINCT FROM NEW.batch_id THEN
        RAISE EXCEPTION
            'Snapshot rows cannot be moved between batches.';
    END IF;

    IF TG_OP = 'DELETE' THEN
        parent_batch_id := OLD.batch_id;
    ELSE
        parent_batch_id := NEW.batch_id;
    END IF;

    EXECUTE format(
        'SELECT status FROM public.%I WHERE id = $1 FOR UPDATE',
        TG_ARGV[0]
    )
    INTO parent_status
    USING parent_batch_id;

    IF parent_status IS NULL THEN
        RAISE EXCEPTION 'Snapshot batch does not exist.';
    END IF;

    IF parent_status = 'locked' THEN
        RAISE EXCEPTION
            'Snapshot rows belonging to a locked batch cannot be changed.';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$_$;


--
-- Name: payroll_v2_update_retro_leave_review_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_update_retro_leave_review_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: payroll_v2_validate_config_publication(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_validate_config_publication(p_config_version_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_version RECORD;
    v_active_rule_count INTEGER;
BEGIN
    SELECT
        effective_from,
        effective_to
    INTO v_version
    FROM public.payroll_v2_config_versions
    WHERE id = p_config_version_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Payroll configuration version does not exist.';
    END IF;

    -- Lock all referenced active components in a consistent order.
    PERFORM c.id
    FROM public.payroll_v2_components c
    JOIN public.payroll_v2_config_rules r
      ON r.component_id = c.id
    WHERE r.config_version_id = p_config_version_id
      AND r.is_active = TRUE
    ORDER BY c.id
    FOR SHARE OF c;

    SELECT COUNT(*)
    INTO v_active_rule_count
    FROM public.payroll_v2_config_rules
    WHERE config_version_id = p_config_version_id
      AND is_active = TRUE;

    IF v_active_rule_count = 0 THEN
        RAISE EXCEPTION
            'A payroll configuration cannot be published without at least one active rule.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.payroll_v2_config_rules r
        JOIN public.payroll_v2_components c
          ON c.id = r.component_id
        WHERE r.config_version_id = p_config_version_id
          AND r.is_active = TRUE
          AND c.is_active = FALSE
    ) THEN
        RAISE EXCEPTION
            'Every active configuration rule must reference an active component.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.payroll_v2_config_rules r
        WHERE r.config_version_id = p_config_version_id
          AND r.is_active = TRUE
          AND (
              r.effective_from < v_version.effective_from
              OR (
                  v_version.effective_to IS NOT NULL
                  AND (
                      r.effective_to IS NULL
                      OR r.effective_to > v_version.effective_to
                  )
              )
          )
    ) THEN
        RAISE EXCEPTION
            'Active rule dates must fall within the parent configuration effective dates.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.payroll_v2_config_rules r
        WHERE r.config_version_id = p_config_version_id
          AND r.is_active = TRUE
          AND (
              (
                  r.calculation_method IN (
                      'percentage_of_basic',
                      'percentage_of_gross',
                      'percentage_of_ctc'
                  )
                  AND (
                      r.calculation_value < 0
                      OR r.calculation_value > 100
                  )
              )
              OR (
                  r.calculation_method = 'fixed'
                  AND r.calculation_value < 0
              )
              OR (
                  r.calculation_method = 'formula'
                  AND (
                      jsonb_typeof(r.formula_config) <> 'object'
                      OR r.formula_config = '{}'::jsonb
                  )
              )
          )
    ) THEN
        RAISE EXCEPTION
            'One or more active configuration rules have invalid calculation values or formula definitions.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.payroll_v2_config_rules a
        JOIN public.payroll_v2_config_rules b
          ON b.config_version_id = a.config_version_id
         AND b.component_id = a.component_id
         AND b.id > a.id
         AND b.is_active = TRUE
         AND daterange(
                b.effective_from,
                b.effective_to,
                '[]'
             ) && daterange(
                a.effective_from,
                a.effective_to,
                '[]'
             )
        WHERE a.config_version_id = p_config_version_id
          AND a.is_active = TRUE
    ) THEN
        RAISE EXCEPTION
            'Active rules for the same component cannot have overlapping effective dates.';
    END IF;
END;
$$;


--
-- Name: payroll_v2_validate_run_reopen(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_validate_run_reopen() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.reopen_reason IS NOT NULL THEN
            RAISE EXCEPTION
                'A new payroll run cannot have a reopening reason.';
        END IF;

        RETURN NEW;
    END IF;

    IF OLD.status IN ('review', 'approved')
       AND NEW.status = 'draft' THEN

        -- Verify the acting HR/CEO.
        PERFORM public.payroll_v2_current_actor_id();

        IF NULLIF(BTRIM(NEW.reopen_reason), '') IS NULL THEN
            RAISE EXCEPTION
                'A mandatory reason is required to reopen payroll.';
        END IF;

        -- Previous approval must not carry forward.
        NEW.approved_by := NULL;
        NEW.approved_at := NULL;

    ELSE
        -- Reopening reason can only be supplied during reopening.
        IF NEW.reopen_reason IS DISTINCT FROM OLD.reopen_reason THEN
            RAISE EXCEPTION
                'Reopening reason can only be changed during a valid reopening.';
        END IF;

        -- The reason is captured in the audit event.
        NEW.reopen_reason := NULL;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: payroll_v2_validate_source_batches(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_v2_validate_source_batches(p_attendance_batch_id uuid, p_leave_batch_id uuid, p_lop_batch_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_att record;
    v_leave record;
    v_lop record;
    v_errors jsonb := '[]'::jsonb;
    v_warnings jsonb := '[]'::jsonb;
    v_attendance_rows integer := 0;
    v_leave_rows integer := 0;
    v_lop_rows integer := 0;
    v_review_rows integer := 0;
    v_pending_lop integer := 0;
    v_overlap_rows integer := 0;
    v_unassigned integer := 0;
BEGIN
    IF NOT public.payroll_v2_is_hr_or_ceo() THEN
        RAISE EXCEPTION 'Only HR or CEO can validate payroll snapshots';
    END IF;

    SELECT * INTO v_att
    FROM public.payroll_v2_attendance_batches
    WHERE id = p_attendance_batch_id;

    SELECT * INTO v_leave
    FROM public.payroll_v2_leave_batches
    WHERE id = p_leave_batch_id;

    SELECT * INTO v_lop
    FROM public.payroll_v2_lop_batches
    WHERE id = p_lop_batch_id;

    IF v_att.id IS NULL OR v_leave.id IS NULL OR v_lop.id IS NULL THEN
        RAISE EXCEPTION 'One or more source snapshot batches do not exist';
    END IF;

    IF v_att.payroll_year <> v_leave.payroll_year
       OR v_att.payroll_year <> v_lop.payroll_year
       OR v_att.payroll_month <> v_leave.payroll_month
       OR v_att.payroll_month <> v_lop.payroll_month
       OR v_att.revision_no <> v_leave.revision_no
       OR v_att.revision_no <> v_lop.revision_no THEN
        v_errors := v_errors || jsonb_build_array(
            'Attendance, leave and LOP batches must have matching periods and revisions'
        );
    END IF;

    IF v_att.status <> 'draft'
       OR v_leave.status <> 'draft'
       OR v_lop.status <> 'draft' THEN
        v_errors := v_errors || jsonb_build_array(
            'All source batches must remain draft during validation'
        );
    END IF;

    SELECT COUNT(*) INTO v_attendance_rows
    FROM public.payroll_v2_attendance_days
    WHERE batch_id = p_attendance_batch_id;

    SELECT COUNT(*) INTO v_leave_rows
    FROM public.payroll_v2_leave_days
    WHERE batch_id = p_leave_batch_id;

    SELECT COUNT(*) INTO v_lop_rows
    FROM public.payroll_v2_lop_days
    WHERE batch_id = p_lop_batch_id;

    SELECT COUNT(*) INTO v_review_rows
    FROM public.payroll_v2_attendance_days
    WHERE batch_id = p_attendance_batch_id
      AND requires_hr_review;

    SELECT COUNT(*) INTO v_pending_lop
    FROM public.payroll_v2_lop_days
    WHERE batch_id = p_lop_batch_id
      AND confirmation_status = 'pending';

    SELECT COUNT(*) INTO v_overlap_rows
    FROM (
        SELECT employee_id, leave_date
        FROM public.payroll_v2_leave_days
        WHERE batch_id = p_leave_batch_id
        GROUP BY employee_id, leave_date
        HAVING COUNT(*) > 1
    ) AS overlapping_dates;
    SELECT COUNT(*) INTO v_unassigned
    FROM public.employees e
    WHERE e.status IN ('active', 'on_notice')
      AND e.joining_date <= make_date(v_att.payroll_year, v_att.payroll_month, 1)
                               + interval '1 month - 1 day'
      AND NOT EXISTS (
          SELECT 1
          FROM public.payroll_v2_employee_assignments a
          WHERE a.employee_id = e.id
            AND a.status = 'approved'
            AND a.effective_from <= (
                make_date(v_att.payroll_year, v_att.payroll_month, 1)
                + interval '1 month - 1 day'
            )::date
            AND (
                a.effective_to IS NULL
                OR a.effective_to >= make_date(
                    v_att.payroll_year, v_att.payroll_month, 1
                )
            )
      );

    IF v_attendance_rows = 0 THEN
        v_errors := v_errors || jsonb_build_array(
            'Attendance snapshot contains no rows'
        );
    END IF;

    IF v_unassigned > 0 THEN
        v_errors := v_errors || jsonb_build_array(
            format('%s active employees have no approved effective salary assignment', v_unassigned)
        );
    END IF;

    IF v_review_rows > 0 THEN
        v_warnings := v_warnings || jsonb_build_array(
            format('%s attendance rows require HR review', v_review_rows)
        );
    END IF;

    IF v_overlap_rows > 0 THEN
        v_warnings := v_warnings || jsonb_build_array(
            format('%s employee/date combinations contain overlapping approved leave', v_overlap_rows)
        );
    END IF;

    IF v_pending_lop > 0 THEN
        v_warnings := v_warnings || jsonb_build_array(
            format('%s LOP rows are pending HR confirmation', v_pending_lop)
        );
    END IF;

    RETURN jsonb_build_object(
        'valid', jsonb_array_length(v_errors) = 0,
        'payroll_year', v_att.payroll_year,
        'payroll_month', v_att.payroll_month,
        'revision_no', v_att.revision_no,
        'attendance_rows', v_attendance_rows,
        'leave_rows', v_leave_rows,
        'lop_rows', v_lop_rows,
        'attendance_hr_review_rows', v_review_rows,
        'pending_lop_rows', v_pending_lop,
        'overlapping_leave_dates', v_overlap_rows,
        'employees_without_approved_assignment', v_unassigned,
        'errors', v_errors,
        'warnings', v_warnings,
        'next_step', CASE
            WHEN jsonb_array_length(v_errors) > 0
                THEN 'Resolve errors before payroll calculation'
            WHEN jsonb_array_length(v_warnings) > 0
                THEN 'HR review required before locking source batches'
            ELSE 'Source snapshots passed validation; remain in draft'
        END
    );
END;
$$;


--
-- Name: prepare_joining_offer_revision(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prepare_joining_offer_revision(p_candidate_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_candidate public.joining_candidates%ROWTYPE;
BEGIN
  -- Always lock candidate first.
  SELECT *
  INTO v_candidate
  FROM public.joining_candidates
  WHERE id = p_candidate_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Candidate not found.'
    );
  END IF;

  IF v_candidate.status NOT IN ('selected', 'offer_sent') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'A new offer cannot be sent in the candidate''s current status.'
    );
  END IF;

  IF v_candidate.accepted_offer_document_id IS NOT NULL
     OR v_candidate.status = 'offer_accepted' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'An accepted offer cannot be revised. Create a separate HR-approved revision process.'
    );
  END IF;

  -- Revoke all previously active response links.
  UPDATE public.joining_action_tokens
  SET revoked_at = now()
  WHERE candidate_id = p_candidate_id
    AND used_at IS NULL
    AND revoked_at IS NULL;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Previous offer response links have been revoked.'
  );
END;
$$;


--
-- Name: prevent_leave_request_overlap_v2(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_leave_request_overlap_v2() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    conflicting_request RECORD;
BEGIN
    -- Only pending and approved requests block overlapping dates.
    IF COALESCE(NEW.status, '') NOT IN ('pending', 'approved') THEN
        RETURN NEW;
    END IF;

    IF NEW.employee_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.start_date IS NULL
       OR NEW.end_date IS NULL
       OR NEW.start_date > NEW.end_date THEN
        RAISE EXCEPTION
            'Invalid leave date range.';
    END IF;

    -- Prevent simultaneous submissions for the same employee.
    PERFORM pg_advisory_xact_lock(
        hashtextextended(NEW.employee_id::text, 0)
    );

    SELECT
        id,
        start_date,
        end_date,
        status
    INTO conflicting_request
    FROM public.leave_requests
    WHERE employee_id = NEW.employee_id
      AND status IN ('pending', 'approved')
      AND daterange(start_date, end_date, '[]')
          && daterange(NEW.start_date, NEW.end_date, '[]')
      AND (TG_OP = 'INSERT' OR id <> NEW.id)
    ORDER BY start_date
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION
            'Leave dates overlap with existing % request from % to %.',
            conflicting_request.status,
            conflicting_request.start_date,
            conflicting_request.end_date;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: prevent_payroll_v2_salary_assignment_overlap(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_payroll_v2_salary_assignment_overlap() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    conflicting_assignment RECORD;
BEGIN
    IF NEW.status <> 'active' THEN
        RETURN NEW;
    END IF;

    IF NEW.employee_id IS NULL
       OR NEW.effective_from IS NULL
       OR (
           NEW.effective_to IS NOT NULL
           AND NEW.effective_to < NEW.effective_from
       ) THEN
        RAISE EXCEPTION
            'Invalid active salary assignment.';
    END IF;

    -- Serialize changes to one employee's assignments.
    PERFORM pg_advisory_xact_lock(
        hashtextextended(NEW.employee_id::text, 1)
    );

    SELECT
        id,
        effective_from,
        effective_to
    INTO conflicting_assignment
    FROM public.payroll_v2_employee_assignments
    WHERE employee_id = NEW.employee_id
      AND status = 'active'
      AND id <> NEW.id
      AND daterange(
            effective_from,
            COALESCE(effective_to, 'infinity'::date),
            '[]'
          )
          &&
          daterange(
            NEW.effective_from,
            COALESCE(NEW.effective_to, 'infinity'::date),
            '[]'
          )
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION
            'Active salary assignment overlaps with existing assignment % (% to %). End or correct the previous assignment before activating this one.',
            conflicting_assignment.id,
            conflicting_assignment.effective_from,
            conflicting_assignment.effective_to;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: preview_daily_absence(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preview_daily_absence(p_attendance_date date) RETURNS TABLE(employee_id uuid, employee_code text, employee_name text, attendance_date date, calendar_id uuid, attendance_status text, reason text)
    LANGUAGE sql STABLE
    AS $$
    WITH eligible_employees AS (
        SELECT
            e.id,
            e.employee_id AS employee_code,
            concat_ws(' ', e.first_name, e.last_name) AS employee_name,
            CASE
                WHEN e.project_id IS NULL
                    THEN 'a72296b2-30f8-4c03-b35e-7aceb334d163'::uuid
                ELSE p.calendar_id
            END AS calendar_id
        FROM public.employees e
        LEFT JOIN public.projects p
            ON p.id = e.project_id
        WHERE e.status IN ('active', 'on_notice')
          AND e.joining_date <= p_attendance_date
          AND (
              e.exit_date IS NULL
              OR e.exit_date >= p_attendance_date
          )
          AND (
              e.status <> 'on_notice'
              OR e.planned_last_working_date IS NULL
              OR e.planned_last_working_date >= p_attendance_date
          )
    ),
    daily_data AS (
        SELECT
            e.*,
            a.id AS attendance_id,
            a.status AS existing_status,
            h.id AS holiday_id,
            h.title AS holiday_title,
            h.is_working_day,

            COUNT(lr.id) FILTER (
                WHERE lr.status = 'approved'
            ) AS approved_leave_count,

            COUNT(lr.id) FILTER (
                WHERE lr.status = 'approved'
                  AND COALESCE(lr.is_half_day, false) = false
            ) AS full_day_leave_count,

            COUNT(lr.id) FILTER (
                WHERE lr.status = 'approved'
                  AND COALESCE(lr.is_half_day, false) = true
            ) AS half_day_leave_count

        FROM eligible_employees e

        LEFT JOIN public.attendance_logs a
            ON a.employee_id = e.id
           AND a.attendance_date = p_attendance_date

        LEFT JOIN public.holidays h
            ON h.calendar_id = e.calendar_id
           AND h.holiday_date = p_attendance_date

        LEFT JOIN public.leave_requests lr
            ON lr.employee_id = e.id
           AND lr.status = 'approved'
           AND p_attendance_date BETWEEN lr.start_date AND lr.end_date

        GROUP BY
            e.id,
            e.employee_code,
            e.employee_name,
            e.calendar_id,
            a.id,
            a.status,
            h.id,
            h.title,
            h.is_working_day
    )
    SELECT
        d.id,
        d.employee_code,
        d.employee_name,
        p_attendance_date,
        d.calendar_id,

        CASE
            WHEN d.attendance_id IS NOT NULL
                THEN d.existing_status

            WHEN d.calendar_id IS NULL
                THEN 'review_required'

            WHEN d.holiday_id IS NOT NULL
                 AND COALESCE(d.is_working_day, false) = false
                THEN 'not_required'

            WHEN d.holiday_id IS NULL
                 AND EXTRACT(ISODOW FROM p_attendance_date) IN (6, 7)
                THEN 'not_required'

            WHEN d.approved_leave_count > 1
                THEN 'review_required'

            WHEN d.full_day_leave_count = 1
                THEN 'on_leave'

            WHEN d.half_day_leave_count = 1
                THEN 'half_day'

            ELSE 'absent'
        END,

        CASE
            WHEN d.attendance_id IS NOT NULL
                THEN 'Existing attendance; preserve record'

            WHEN d.calendar_id IS NULL
                THEN 'Missing project holiday calendar'

            WHEN d.holiday_id IS NOT NULL
                 AND COALESCE(d.is_working_day, false) = false
                THEN COALESCE(d.holiday_title, 'Non-working holiday')

            WHEN d.holiday_id IS NULL
                 AND EXTRACT(ISODOW FROM p_attendance_date) IN (6, 7)
                THEN 'Weekly off'

            WHEN d.approved_leave_count > 1
                THEN 'Multiple approved leave requests; HR review required'

            WHEN d.full_day_leave_count = 1
                THEN 'Approved full-day leave'

            WHEN d.half_day_leave_count = 1
                THEN 'Approved half-day leave; mark half_day'

            ELSE 'No attendance or approved leave on working day'
        END

    FROM daily_data d;
$$;


--
-- Name: register_candidate_onboarding_document(uuid, uuid, uuid, text, text, text, text, bigint, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_candidate_onboarding_document(p_candidate_id uuid, p_submission_id uuid, p_token_id uuid, p_document_type text, p_original_file_name text, p_storage_path text, p_mime_type text, p_file_size_bytes bigint, p_sha256_hash text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_candidate public.joining_candidates%ROWTYPE;
  v_token public.joining_onboarding_tokens%ROWTYPE;
  v_submission public.joining_onboarding_submissions%ROWTYPE;
  v_version INTEGER;
  v_document public.joining_onboarding_documents%ROWTYPE;
BEGIN
  -- Only allow the approved onboarding document identifiers.
  IF p_document_type NOT IN (
    'aadhaar_card',
    'pan_card',
    'driving_license',
    'passport_photo', 'passport',
    'address_proof',
    'education_10th',
    'education_12th',
    'education_graduation',
    'education_post_graduation',
    'education_other',
    'experience_document',
    'relieving_letter',
    'bank_account_proof'
  ) THEN
    RAISE EXCEPTION 'Unsupported document type';
  END IF;

  IF p_original_file_name IS NULL
     OR length(p_original_file_name) < 1
     OR length(p_original_file_name) > 255 THEN
    RAISE EXCEPTION 'Invalid original file name';
  END IF;

  IF p_mime_type NOT IN (
    'application/pdf',
    'image/jpeg',
    'image/png'
  ) THEN
    RAISE EXCEPTION 'Unsupported document MIME type';
  END IF;

  IF p_file_size_bytes IS NULL
     OR p_file_size_bytes < 1
     OR p_file_size_bytes > 10485760 THEN
    RAISE EXCEPTION 'Document must be between 1 byte and 10 MB';
  END IF;

  IF p_sha256_hash IS NULL
     OR p_sha256_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid document hash';
  END IF;

  IF p_storage_path IS NULL
     OR p_storage_path NOT LIKE
       'teens-hr/candidate-onboarding/' ||
       p_candidate_id::TEXT || '/' ||
       p_submission_id::TEXT || '/%' THEN
    RAISE EXCEPTION 'Invalid private storage path';
  END IF;

  -- Lock candidate first. All onboarding document registration
  -- operations for this candidate serialize on this row.
  SELECT *
  INTO v_candidate
  FROM public.joining_candidates
  WHERE id = p_candidate_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_candidate.status <> 'offer_accepted'
     OR v_candidate.onboarding_status <> 'in_progress'
     OR v_candidate.onboarding_submission_id <> p_submission_id
     OR v_candidate.conversion_status IN ('processing', 'completed')
     OR v_candidate.employee_record_id IS NOT NULL THEN
    RAISE EXCEPTION 'Candidate is no longer eligible for onboarding';
  END IF;

  -- Lock and revalidate the exact onboarding token.
  SELECT *
  INTO v_token
  FROM public.joining_onboarding_tokens
  WHERE id = p_token_id
    AND candidate_id = p_candidate_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_token.used_at IS NOT NULL
     OR v_token.revoked_at IS NOT NULL
     OR v_token.expires_at <= NOW() THEN
    RAISE EXCEPTION 'Onboarding session is no longer valid';
  END IF;

  -- Lock and verify the candidate's current draft submission.
  SELECT *
  INTO v_submission
  FROM public.joining_onboarding_submissions
  WHERE id = p_submission_id
    AND candidate_id = p_candidate_id
  FOR UPDATE;

  IF NOT FOUND OR v_submission.status <> 'draft' THEN
    RAISE EXCEPTION 'Onboarding submission is no longer editable';
  END IF;

  -- Version sequence is global per candidate and document type,
  -- including documents uploaded for earlier submission versions.
  SELECT COALESCE(MAX(version), 0) + 1
  INTO v_version
  FROM public.joining_onboarding_documents
  WHERE candidate_id = p_candidate_id
    AND document_type = p_document_type;

  INSERT INTO public.joining_onboarding_documents (
    candidate_id,
    submission_id,
    document_type,
    version,
    original_file_name,
    storage_path,
    mime_type,
    file_size_bytes,
    sha256_hash,
    verification_status
  )
  VALUES (
    p_candidate_id,
    p_submission_id,
    p_document_type,
    v_version,
    p_original_file_name,
    p_storage_path,
    p_mime_type,
    p_file_size_bytes,
    p_sha256_hash,
    'pending'
  )
  RETURNING * INTO v_document;

  INSERT INTO public.joining_onboarding_events (
    candidate_id,
    submission_id,
    actor_type,
    actor_user_id,
    event_type,
    event_details
  )
  VALUES (
    p_candidate_id,
    p_submission_id,
    'candidate',
    NULL,
    'onboarding_document_uploaded',
    jsonb_build_object(
      'document_id', v_document.id,
      'document_type', v_document.document_type,
      'version', v_document.version,
      'file_size_bytes', v_document.file_size_bytes,
      'sha256_hash', v_document.sha256_hash
    )
  );

  RETURN jsonb_build_object(
    'id', v_document.id,
    'candidate_id', v_document.candidate_id,
    'submission_id', v_document.submission_id,
    'document_type', v_document.document_type,
    'version', v_document.version,
    'verification_status', v_document.verification_status,
    'uploaded_at', v_document.uploaded_at
  );
END;
$_$;


--
-- Name: register_candidate_onboarding_document(uuid, uuid, uuid, text, text, text, text, bigint, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_candidate_onboarding_document(p_candidate_id uuid, p_submission_id uuid, p_token_id uuid, p_document_type text, p_original_file_name text, p_storage_path text, p_mime_type text, p_file_size_bytes bigint, p_sha256_hash text, p_employment_record_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_candidate public.joining_candidates%ROWTYPE;
  v_token public.joining_onboarding_tokens%ROWTYPE;
  v_submission public.joining_onboarding_submissions%ROWTYPE;
  v_version integer;
  v_document public.joining_onboarding_documents%ROWTYPE;
  v_employment_record jsonb;
  v_is_employment_document boolean;

  v_existing_document_id uuid;
  v_existing_submission_id uuid;
  v_existing_status text;
  v_correction_event jsonb;
  v_resubmission_authorized boolean := false;
BEGIN
  -- 1. Validate document type.
  IF p_document_type NOT IN (
    'aadhaar_card',
    'pan_card',
    'driving_license',
    'passport_photo',
    'passport',
    'address_proof',
    'education_10th',
    'education_12th',
    'education_graduation',
    'education_post_graduation',
    'education_other',
    'experience_document',
    'relieving_letter',
    'previous_joining_letter',
    'payslip_1',
    'payslip_2',
    'payslip_3',
    'payslip_4',
    'payslip_5',
    'payslip_6',
    'salary_hike_letter',
    'appraisal_letter',
    'bank_account_proof'
  ) THEN
    RAISE EXCEPTION 'Unsupported document type';
  END IF;

  -- 2. Validate employer association.
  v_is_employment_document :=
    p_document_type IN (
      'experience_document',
      'relieving_letter',
      'previous_joining_letter',
      'payslip_1',
      'payslip_2',
      'payslip_3',
      'payslip_4',
      'payslip_5',
      'payslip_6',
      'salary_hike_letter',
      'appraisal_letter'
    );

  IF v_is_employment_document
     AND p_employment_record_id IS NULL THEN
    RAISE EXCEPTION 'EMPLOYMENT_RECORD_ID_REQUIRED';
  END IF;

  IF NOT v_is_employment_document
     AND p_employment_record_id IS NOT NULL THEN
    RAISE EXCEPTION 'EMPLOYMENT_RECORD_ID_NOT_ALLOWED';
  END IF;

  -- 3. Validate file metadata.
  IF p_original_file_name IS NULL
     OR length(p_original_file_name) < 1
     OR length(p_original_file_name) > 255 THEN
    RAISE EXCEPTION 'Invalid original file name';
  END IF;

  IF p_mime_type NOT IN (
    'application/pdf',
    'image/jpeg',
    'image/png'
  ) THEN
    RAISE EXCEPTION 'Unsupported document MIME type';
  END IF;

  IF p_file_size_bytes IS NULL
     OR p_file_size_bytes < 1
     OR p_file_size_bytes > 10485760 THEN
    RAISE EXCEPTION 'Document must be between 1 byte and 10 MB';
  END IF;

  IF p_sha256_hash IS NULL
     OR p_sha256_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid document hash';
  END IF;

  -- 4. Validate private storage path.
  IF p_storage_path IS NULL THEN
    RAISE EXCEPTION 'Invalid private storage path';
  END IF;

  IF v_is_employment_document THEN
    IF p_storage_path NOT LIKE
      'teens-hr/candidate-onboarding/' ||
      p_candidate_id::text || '/' ||
      p_submission_id::text || '/' ||
      p_employment_record_id::text || '/%' THEN
      RAISE EXCEPTION 'Invalid employment document storage path';
    END IF;
  ELSE
    IF p_storage_path NOT LIKE
      'teens-hr/candidate-onboarding/' ||
      p_candidate_id::text || '/' ||
      p_submission_id::text || '/%' THEN
      RAISE EXCEPTION 'Invalid private storage path';
    END IF;
  END IF;

  -- 5. Lock and validate candidate.
  SELECT *
    INTO v_candidate
    FROM public.joining_candidates
   WHERE id = p_candidate_id
   FOR UPDATE;

  IF NOT FOUND
     OR NOT (
       v_candidate.status = 'offer_accepted'
       OR (
         v_candidate.status = 'joining_letter_sent'
         AND v_candidate.onboarding_verification_reopened_at IS NOT NULL
       )
     )
     OR v_candidate.onboarding_status NOT IN (
       'in_progress',
       'correction_required'
     )
     OR v_candidate.onboarding_submission_id
          IS DISTINCT FROM p_submission_id
     OR v_candidate.conversion_status IN ('processing', 'completed')
     OR v_candidate.employee_record_id IS NOT NULL THEN
    RAISE EXCEPTION 'Candidate is no longer eligible for onboarding';
  END IF;

  -- 6. Lock and validate onboarding token.
  SELECT *
    INTO v_token
    FROM public.joining_onboarding_tokens
   WHERE id = p_token_id
     AND candidate_id = p_candidate_id
     AND submission_id = p_submission_id
   FOR UPDATE;

  IF NOT FOUND
     OR v_token.used_at IS NOT NULL
     OR v_token.revoked_at IS NOT NULL
     OR v_token.expires_at <= NOW() THEN
    RAISE EXCEPTION 'Onboarding session is no longer valid';
  END IF;

  -- 7. Lock and validate current draft submission.
  SELECT *
    INTO v_submission
    FROM public.joining_onboarding_submissions
   WHERE id = p_submission_id
     AND candidate_id = p_candidate_id
   FOR UPDATE;

  IF NOT FOUND OR v_submission.status <> 'draft' THEN
    RAISE EXCEPTION 'Onboarding submission is no longer editable';
  END IF;

  -- 8. Verify employer ID belongs to the active submission.
  IF v_is_employment_document THEN
    SELECT employment.item
      INTO v_employment_record
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(
            v_submission.submission_data
              -> 'previousEmploymentDetails'
              -> 'employmentHistory'
          ) = 'array'
          THEN v_submission.submission_data
            -> 'previousEmploymentDetails'
            -> 'employmentHistory'
          ELSE '[]'::jsonb
        END
      ) AS employment(item)
     WHERE employment.item ->> 'id' =
           p_employment_record_id::text
     LIMIT 1;

    IF v_employment_record IS NULL THEN
      RAISE EXCEPTION 'EMPLOYMENT_RECORD_NOT_FOUND';
    END IF;
  END IF;

  -- 9. Find the nearest existing document in this submission's ancestry.
  -- A document already uploaded into the active submission takes precedence
  -- and cannot be uploaded a second time.
  WITH RECURSIVE ancestry AS (
    SELECT
      s.id,
      s.supersedes_submission_id,
      0 AS depth
    FROM public.joining_onboarding_submissions s
    WHERE s.id = p_submission_id
      AND s.candidate_id = p_candidate_id

    UNION ALL

    SELECT
      parent.id,
      parent.supersedes_submission_id,
      child.depth + 1
    FROM public.joining_onboarding_submissions parent
    JOIN ancestry child
      ON parent.id = child.supersedes_submission_id
    WHERE parent.candidate_id = p_candidate_id
      AND child.depth < 20
  )
  SELECT
    d.id,
    d.submission_id,
    d.verification_status
  INTO
    v_existing_document_id,
    v_existing_submission_id,
    v_existing_status
  FROM ancestry a
  JOIN public.joining_onboarding_documents d
    ON d.submission_id = a.id
   AND d.candidate_id = p_candidate_id
   AND d.document_type = p_document_type
   AND d.employment_record_id
       IS NOT DISTINCT FROM p_employment_record_id
  ORDER BY
    a.depth ASC,
    d.version DESC,
    d.uploaded_at DESC
  LIMIT 1;

  IF FOUND THEN

    -- Never allow a second upload for the same document key
    -- when the active submission already has a document.
    IF v_existing_submission_id = p_submission_id THEN
      RAISE EXCEPTION
        'DOCUMENT_ALREADY_UPLOADED_IN_ACTIVE_SUBMISSION';
    END IF;

    -- Only approved or rejected ancestor documents can be replaced.
    IF v_existing_status NOT IN ('approved', 'rejected') THEN
      RAISE EXCEPTION
        'DOCUMENT_REPLACEMENT_NOT_AUTHORIZED';
    END IF;

    -- Read the correction event belonging to this exact active draft.
    SELECT e.event_details
      INTO v_correction_event
      FROM public.joining_onboarding_events e
     WHERE e.candidate_id = p_candidate_id
       AND e.submission_id = p_submission_id
       AND e.event_type = 'onboarding_corrections_requested'
     ORDER BY e.created_at DESC
     LIMIT 1;

    -- Match the exact previous document, document type and employer.
    SELECT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(
            v_correction_event -> 'correction_items'
          ) = 'array'
          THEN v_correction_event -> 'correction_items'
          ELSE '[]'::jsonb
        END
      ) AS item(value)
      WHERE item.value ->> 'type' = 'document'
        AND item.value ->> 'document_id' =
            v_existing_document_id::text
        AND item.value ->> 'document_type' =
            p_document_type
        AND (
          item.value ->> 'employment_record_id'
        ) IS NOT DISTINCT FROM
          p_employment_record_id::text
    )
    INTO v_resubmission_authorized;

    IF NOT v_resubmission_authorized THEN
      RAISE EXCEPTION
        'DOCUMENT_REPLACEMENT_NOT_AUTHORIZED';
    END IF;
  END IF;

  -- 10. Calculate version independently for each employer and document type.
  SELECT COALESCE(MAX(version), 0) + 1
    INTO v_version
    FROM public.joining_onboarding_documents
   WHERE candidate_id = p_candidate_id
     AND document_type = p_document_type
     AND employment_record_id
         IS NOT DISTINCT FROM p_employment_record_id;

  -- 11. Register new document metadata.
  INSERT INTO public.joining_onboarding_documents (
    candidate_id,
    submission_id,
    document_type,
    employment_record_id,
    version,
    original_file_name,
    storage_path,
    mime_type,
    file_size_bytes,
    sha256_hash,
    verification_status
  )
  VALUES (
    p_candidate_id,
    p_submission_id,
    p_document_type,
    p_employment_record_id,
    v_version,
    p_original_file_name,
    p_storage_path,
    p_mime_type,
    p_file_size_bytes,
    p_sha256_hash,
    'pending'
  )
  RETURNING * INTO v_document;

  -- 12. Preserve upload audit event.
  INSERT INTO public.joining_onboarding_events (
    candidate_id,
    submission_id,
    actor_type,
    actor_user_id,
    event_type,
    event_details
  )
  VALUES (
    p_candidate_id,
    p_submission_id,
    'candidate',
    NULL,
    'onboarding_document_uploaded',
    jsonb_build_object(
      'document_id', v_document.id,
      'document_type', v_document.document_type,
      'employment_record_id', v_document.employment_record_id,
      'version', v_document.version,
      'file_size_bytes', v_document.file_size_bytes,
      'sha256_hash', v_document.sha256_hash
    )
  );

  -- 13. Return registered document details.
  RETURN jsonb_build_object(
    'id', v_document.id,
    'candidate_id', v_document.candidate_id,
    'submission_id', v_document.submission_id,
    'document_type', v_document.document_type,
    'employment_record_id', v_document.employment_record_id,
    'version', v_document.version,
    'verification_status', v_document.verification_status,
    'uploaded_at', v_document.uploaded_at
  );
END;
$_$;


--
-- Name: reopen_candidate_onboarding_verification(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reopen_candidate_onboarding_verification(p_candidate_id uuid, p_actor_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_candidate public.joining_candidates%ROWTYPE;
  v_submission_status text;
  v_reopened_at timestamptz := now();
BEGIN
  IF p_candidate_id IS NULL OR p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Candidate ID and HR user ID are required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_actor_user_id
      AND role = 'hr'
  ) THEN
    RAISE EXCEPTION 'Only an HR user can reopen onboarding verification.';
  END IF;

  SELECT *
  INTO v_candidate
  FROM public.joining_candidates
  WHERE id = p_candidate_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Joining candidate not found.';
  END IF;

  IF v_candidate.onboarding_verified_at IS NULL
     OR v_candidate.onboarding_verified_by IS NULL THEN
    RAISE EXCEPTION 'Only completed onboarding verification can be reopened.';
  END IF;

  IF v_candidate.conversion_status IN ('processing', 'completed')
     OR v_candidate.employee_record_id IS NOT NULL
     OR v_candidate.employee_id IS NOT NULL THEN
    RAISE EXCEPTION 'A converted or converting candidate cannot be reopened.';
  END IF;

  IF v_candidate.onboarding_verification_reopened_at IS NOT NULL THEN
    RAISE EXCEPTION 'Onboarding verification is already reopened.';
  END IF;

  IF v_candidate.status <> 'joining_letter_sent' THEN
    RAISE EXCEPTION 'Only candidates with an issued joining letter can be reopened.';
  END IF;

  IF v_candidate.onboarding_submission_id IS NULL THEN
    RAISE EXCEPTION 'The current onboarding submission is missing.';
  END IF;

  SELECT status
  INTO v_submission_status
  FROM public.joining_onboarding_submissions
  WHERE id = v_candidate.onboarding_submission_id
    AND candidate_id = p_candidate_id;

  IF NOT FOUND OR v_submission_status <> 'submitted' THEN
    RAISE EXCEPTION 'The current onboarding submission is not in submitted status.';
  END IF;

  INSERT INTO public.joining_onboarding_events (
    id,
    candidate_id,
    submission_id,
    actor_type,
    actor_user_id,
    event_type,
    event_details,
    created_at
  )
  VALUES (
    gen_random_uuid(),
    p_candidate_id,
    v_candidate.onboarding_submission_id,
    'hr',
    p_actor_user_id,
    'onboarding_verification_reopened',
    jsonb_build_object(
      'reopened_at', v_reopened_at,
      'reopened_by', p_actor_user_id,
      'previous_verified_at', v_candidate.onboarding_verified_at,
      'previous_verified_by', v_candidate.onboarding_verified_by,
      'previous_submission_id', v_candidate.onboarding_submission_id,
      'previous_onboarding_status', v_candidate.onboarding_status,
      'previous_candidate_status', v_candidate.status
    ),
    v_reopened_at
  );

  UPDATE public.joining_candidates
  SET
    onboarding_verification_reopened_at = v_reopened_at,
    onboarding_verification_reopened_by = p_actor_user_id,
    onboarding_verified_at = NULL,
    onboarding_verified_by = NULL,
    onboarding_status = 'not_started',
    onboarding_submission_id = NULL,
    updated_at = v_reopened_at
  WHERE id = p_candidate_id;

  RETURN true;
END;
$$;


--
-- Name: request_candidate_onboarding_corrections(uuid, uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_candidate_onboarding_corrections(p_candidate_id uuid, p_expected_submission_id uuid, p_actor_user_id uuid, p_actor_type text, p_instructions text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_candidate public.joining_candidates%ROWTYPE;
  v_source_submission public.joining_onboarding_submissions%ROWTYPE;
  v_new_submission public.joining_onboarding_submissions%ROWTYPE;
  v_next_version integer;
  v_instructions text;
  v_correction_items jsonb;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  IF lower(coalesce(p_actor_type, '')) NOT IN ('hr', 'ceo')
     OR p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ACTOR';
  END IF;

  v_instructions := trim(coalesce(p_instructions, ''));

  IF length(v_instructions) < 1
     OR length(v_instructions) > 4000 THEN
    RAISE EXCEPTION 'CORRECTION_INSTRUCTIONS_REQUIRED';
  END IF;

  SELECT *
    INTO v_candidate
    FROM public.joining_candidates
   WHERE id = p_candidate_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CANDIDATE_NOT_FOUND';
  END IF;

  IF v_candidate.status <> 'offer_accepted'
     OR v_candidate.onboarding_status <> 'submitted'
     OR v_candidate.onboarding_submission_id
          IS DISTINCT FROM p_expected_submission_id
     OR v_candidate.conversion_status IN ('processing', 'completed')
     OR v_candidate.employee_record_id IS NOT NULL THEN
    RAISE EXCEPTION 'CANDIDATE_NOT_ELIGIBLE_FOR_CORRECTIONS';
  END IF;

  SELECT *
    INTO v_source_submission
    FROM public.joining_onboarding_submissions
   WHERE id = p_expected_submission_id
     AND candidate_id = p_candidate_id
   FOR UPDATE;

  IF NOT FOUND
     OR v_source_submission.status <> 'submitted' THEN
    RAISE EXCEPTION 'SUBMITTED_VERSION_NOT_FOUND';
  END IF;

  -- Collect section corrections and document-specific corrections.
  -- Private HR review notes are never included.
  SELECT coalesce(
    jsonb_agg(item ORDER BY sort_order),
    '[]'::jsonb
  )
  INTO v_correction_items
  FROM (
    SELECT
      1 AS sort_order,
      jsonb_build_object(
        'type', 'section',
        'key', 'personal',
        'label', 'Personal Details',
        'instruction', s.personal_correction_instructions
      ) AS item
    FROM public.joining_onboarding_submissions s
    WHERE s.id = v_source_submission.id
      AND s.personal_verification_status = 'correction_required'
      AND nullif(btrim(s.personal_correction_instructions), '') IS NOT NULL

    UNION ALL

    SELECT
      2,
      jsonb_build_object(
        'type', 'section',
        'key', 'address',
        'label', 'Address Details',
        'instruction', s.address_correction_instructions
      )
    FROM public.joining_onboarding_submissions s
    WHERE s.id = v_source_submission.id
      AND s.address_verification_status = 'correction_required'
      AND nullif(btrim(s.address_correction_instructions), '') IS NOT NULL

    UNION ALL

    SELECT
      3,
      jsonb_build_object(
        'type', 'section',
        'key', 'bank',
        'label', 'Bank Details',
        'instruction', s.bank_correction_instructions
      )
    FROM public.joining_onboarding_submissions s
    WHERE s.id = v_source_submission.id
      AND s.bank_verification_status = 'correction_required'
      AND nullif(btrim(s.bank_correction_instructions), '') IS NOT NULL

    UNION ALL

    SELECT
      4,
      jsonb_build_object(
        'type', 'section',
        'key', 'identity',
        'label', 'Identity Details',
        'instruction', s.identity_correction_instructions
      )
    FROM public.joining_onboarding_submissions s
    WHERE s.id = v_source_submission.id
      AND s.identity_verification_status = 'correction_required'
      AND nullif(btrim(s.identity_correction_instructions), '') IS NOT NULL

    UNION ALL

    SELECT
      5,
      jsonb_build_object(
        'type', 'section',
        'key', 'education',
        'label', 'Education Details',
        'instruction', s.education_correction_instructions
      )
    FROM public.joining_onboarding_submissions s
    WHERE s.id = v_source_submission.id
      AND s.education_verification_status = 'correction_required'
      AND nullif(btrim(s.education_correction_instructions), '') IS NOT NULL

    UNION ALL

    SELECT
      6,
      jsonb_build_object(
        'type', 'section',
        'key', 'emergency',
        'label', 'Emergency Contacts',
        'instruction', s.emergency_correction_instructions
      )
    FROM public.joining_onboarding_submissions s
    WHERE s.id = v_source_submission.id
      AND s.emergency_verification_status = 'correction_required'
      AND nullif(btrim(s.emergency_correction_instructions), '') IS NOT NULL

    UNION ALL

    SELECT
      7,
      jsonb_build_object(
        'type', 'section',
        'key', 'employment',
        'label', 'Previous Employment Details',
        'instruction', s.employment_correction_instructions
      )
    FROM public.joining_onboarding_submissions s
    WHERE s.id = v_source_submission.id
      AND s.employment_verification_status = 'correction_required'
      AND nullif(btrim(s.employment_correction_instructions), '') IS NOT NULL

    UNION ALL

    -- Rejected documents.
    SELECT
      8,
      jsonb_build_object(
        'type', 'document',
        'key', d.document_type,
        'document_id', d.id,
        'document_type', d.document_type,
        'employment_record_id', d.employment_record_id,
        'file_name', d.original_file_name,
        'label',
          CASE
            WHEN d.document_type = 'experience_document'
              THEN 'Experience Document'
            WHEN d.document_type = 'relieving_letter'
              THEN 'Relieving Letter'
            ELSE replace(initcap(d.document_type), '_', ' ')
          END,
        'instruction', d.correction_instructions
      )
    FROM public.joining_onboarding_documents d
    WHERE d.candidate_id = p_candidate_id
      AND d.submission_id = v_source_submission.id
      AND d.verification_status = 'rejected'
      AND nullif(btrim(d.correction_instructions), '') IS NOT NULL

    UNION ALL

    -- Previously approved documents explicitly marked by HR for replacement.
    SELECT
      9,
      jsonb_build_object(
        'type', 'document',
        'key', d.document_type,
        'document_id', d.id,
        'document_type', d.document_type,
        'employment_record_id', d.employment_record_id,
        'file_name', d.original_file_name,
        'label',
          CASE
            WHEN d.document_type = 'experience_document'
              THEN 'Experience Document'
            WHEN d.document_type = 'relieving_letter'
              THEN 'Relieving Letter'
            ELSE replace(initcap(d.document_type), '_', ' ')
          END,
        'instruction', d.resubmission_instructions
      )
    FROM public.joining_onboarding_documents d
    WHERE d.candidate_id = p_candidate_id
      AND d.submission_id = v_source_submission.id
      AND d.verification_status = 'approved'
      AND d.resubmission_requested_at IS NOT NULL
      AND nullif(btrim(d.resubmission_instructions), '') IS NOT NULL
  ) AS correction_items_source;

  SELECT coalesce(max(version), 0) + 1
    INTO v_next_version
    FROM public.joining_onboarding_submissions
   WHERE candidate_id = p_candidate_id;

  INSERT INTO public.joining_onboarding_submissions (
    candidate_id,
    version,
    status,
    submission_data,
    supersedes_submission_id
  )
  VALUES (
    p_candidate_id,
    v_next_version,
    'draft',
    v_source_submission.submission_data,
    v_source_submission.id
  )
  RETURNING * INTO v_new_submission;

  UPDATE public.joining_candidates
     SET onboarding_submission_id = v_new_submission.id,
         onboarding_status = 'correction_required',
         onboarding_draft_created_at = now(),
         onboarding_draft_created_by = p_actor_user_id,
         onboarding_link_sent_at = NULL,
         updated_at = now()
   WHERE id = p_candidate_id;

  INSERT INTO public.joining_onboarding_events (
    candidate_id,
    submission_id,
    actor_type,
    actor_user_id,
    event_type,
    event_details
  )
  VALUES (
    p_candidate_id,
    v_new_submission.id,
    lower(p_actor_type),
    p_actor_user_id,
    'onboarding_corrections_requested',
    jsonb_build_object(
      'instructions', v_instructions,
      'correction_items', v_correction_items,
      'previous_submission_id', v_source_submission.id,
      'previous_version', v_source_submission.version,
      'new_submission_id', v_new_submission.id,
      'new_version', v_new_submission.version,
      'requested_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'candidate_id', p_candidate_id,
    'previous_submission_id', v_source_submission.id,
    'submission_id', v_new_submission.id,
    'version', v_new_submission.version,
    'correction_items_count', jsonb_array_length(v_correction_items),
    'status', 'correction_required'
  );
END;
$$;


--
-- Name: respond_to_joining_offer(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.respond_to_joining_offer(p_token_hash text, p_action text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_candidate_id UUID;
  v_candidate public.joining_candidates%ROWTYPE;
  v_token public.joining_action_tokens%ROWTYPE;
  v_document public.joining_documents%ROWTYPE;
  v_latest_version INTEGER;
  v_new_status TEXT;
  v_updated_count INTEGER;
BEGIN
  -- Validate action and token hash format.
  IF p_action NOT IN ('accept_offer', 'decline_offer') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Invalid offer action.'
    );
  END IF;

  IF p_token_hash IS NULL
     OR p_token_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Invalid offer response token.'
    );
  END IF;

  -- Find candidate without locking the token.
  SELECT candidate_id
  INTO v_candidate_id
  FROM public.joining_action_tokens
  WHERE token_hash = p_token_hash
    AND action = p_action;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'This link is invalid, expired, or already used.'
    );
  END IF;

  -- Lock candidate first to serialize all offer decisions.
  SELECT *
  INTO v_candidate
  FROM public.joining_candidates
  WHERE id = v_candidate_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Candidate not found.'
    );
  END IF;

  -- Lock and revalidate the exact token.
  SELECT *
  INTO v_token
  FROM public.joining_action_tokens
  WHERE token_hash = p_token_hash
    AND action = p_action
    AND candidate_id = v_candidate_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_token.used_at IS NOT NULL
     OR v_token.revoked_at IS NOT NULL
     OR v_token.expires_at IS NULL
     OR v_token.expires_at <= now()
     OR v_token.activated_at IS NULL
     OR v_token.document_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'This link is invalid, expired, or already used.'
    );
  END IF;

  IF v_candidate.status <> 'offer_sent'
     OR v_candidate.accepted_offer_document_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'This offer has already been decided or is no longer active.'
    );
  END IF;

  -- Lock the exact offer document.
  SELECT *
  INTO v_document
  FROM public.joining_documents
  WHERE id = v_token.document_id
    AND candidate_id = v_candidate_id
    AND document_type = 'offer_letter'
  FOR UPDATE;

  IF NOT FOUND
     OR v_document.sent_at IS NULL
     OR v_document.offer_snapshot IS NULL
     OR jsonb_typeof(v_document.offer_snapshot) <> 'object' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'The offer associated with this link is unavailable.'
    );
  END IF;

  -- Check the latest version across ALL offer documents,
  -- including newer revisions that have not been sent yet.
  SELECT MAX(version)
  INTO v_latest_version
  FROM public.joining_documents
  WHERE candidate_id = v_candidate_id
    AND document_type = 'offer_letter';

  IF v_document.version IS DISTINCT FROM v_latest_version THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'This offer has been superseded. Please contact HR for the latest offer.'
    );
  END IF;

  v_new_status := CASE
    WHEN p_action = 'accept_offer' THEN 'offer_accepted'
    ELSE 'offer_declined'
  END;

  -- Record the decision and exact accepted document.
  UPDATE public.joining_candidates
  SET
    status = v_new_status,
    offer_decision_at = now(),
    accepted_offer_document_id = CASE
      WHEN p_action = 'accept_offer' THEN v_document.id
      ELSE NULL
    END,
    updated_at = now()
  WHERE id = v_candidate_id
    AND status = 'offer_sent'
    AND accepted_offer_document_id IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'This offer has already been decided.'
    );
  END IF;

  -- Consume the exact token used for the decision.
  UPDATE public.joining_action_tokens
  SET used_at = now()
  WHERE id = v_token.id
    AND candidate_id = v_candidate_id
    AND used_at IS NULL
    AND revoked_at IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION
      'Unable to consume the selected offer response token.';
  END IF;

  -- Revoke every other outstanding offer response token.
  UPDATE public.joining_action_tokens
  SET revoked_at = now()
  WHERE candidate_id = v_candidate_id
    AND id <> v_token.id
    AND used_at IS NULL
    AND revoked_at IS NULL;

  RETURN jsonb_build_object(
    'success', true,
    'status', v_new_status,
    'accepted_offer_document_id',
      CASE
        WHEN p_action = 'accept_offer' THEN v_document.id
        ELSE NULL
      END,
    'offer_version', v_document.version,
    'message', CASE
      WHEN p_action = 'accept_offer'
        THEN 'You have accepted the offer.'
      ELSE 'You have declined the offer.'
    END
  );
END;
$_$;


--
-- Name: review_candidate_employment_details(uuid, uuid, uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.review_candidate_employment_details(p_candidate_id uuid, p_expected_submission_id uuid, p_actor_user_id uuid, p_actor_type text, p_decision text, p_candidate_instruction text, p_review_notes text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_candidate public.joining_candidates%ROWTYPE;
  v_submission public.joining_onboarding_submissions%ROWTYPE;
  v_previous_status text;
  v_event_type text;
  v_notes text;
  v_candidate_instruction text;
  v_experience_level text;
  v_history jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role access required.';
  END IF;

  IF p_actor_user_id IS NULL
     OR lower(coalesce(p_actor_type, '')) NOT IN ('hr', 'ceo') THEN
    RAISE EXCEPTION 'A valid HR or CEO actor is required.';
  END IF;

  IF p_decision NOT IN ('verify', 'correction_required') THEN
    RAISE EXCEPTION 'Invalid employment verification decision.';
  END IF;

  v_notes := nullif(btrim(coalesce(p_review_notes, '')), '');
  v_candidate_instruction :=
    nullif(btrim(coalesce(p_candidate_instruction, '')), '');

  IF p_decision = 'correction_required'
     AND v_candidate_instruction IS NULL THEN
    RAISE EXCEPTION 'Candidate correction instructions are required.';
  END IF;

  IF length(coalesce(v_notes, '')) > 2000 THEN
    RAISE EXCEPTION 'Review notes cannot exceed 2000 characters.';
  END IF;

  IF length(coalesce(v_candidate_instruction, '')) > 2000 THEN
    RAISE EXCEPTION 'Candidate correction instructions cannot exceed 2000 characters.';
  END IF;

  SELECT *
  INTO v_candidate
  FROM public.joining_candidates
  WHERE id = p_candidate_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Joining candidate not found.';
  END IF;

  IF 
NOT (
       v_candidate.status = 'offer_accepted'
       OR (
         v_candidate.status = 'joining_letter_sent'
         AND v_candidate.onboarding_verification_reopened_at IS NOT NULL
       )
     )

     OR v_candidate.onboarding_submission_id
        IS DISTINCT FROM p_expected_submission_id
     OR v_candidate.conversion_status IN ('processing', 'completed')
     OR v_candidate.employee_record_id IS NOT NULL THEN
    RAISE EXCEPTION 'Candidate is no longer eligible for employment verification.';
  END IF;

  IF v_candidate.onboarding_status <> 'submitted' THEN
    RAISE EXCEPTION 'Candidate onboarding must be submitted before employment verification.';
  END IF;

  SELECT *
  INTO v_submission
  FROM public.joining_onboarding_submissions
  WHERE id = p_expected_submission_id
    AND candidate_id = p_candidate_id
  FOR UPDATE;

  IF NOT FOUND OR v_submission.status <> 'submitted' THEN
    RAISE EXCEPTION 'The active onboarding submission is not available for review.';
  END IF;

  v_experience_level := lower(
    coalesce(
      nullif(v_candidate.experience_level, ''),
      nullif(v_submission.submission_data ->> 'experienceLevel', ''),
      ''
    )
  );

  IF v_experience_level = 'fresher'
     AND coalesce(v_candidate.total_experience_years, 0) = 0
     AND coalesce(v_candidate.total_experience_months, 0) = 0 THEN
    RAISE EXCEPTION 'Previous employment verification is not applicable to freshers.';
  END IF;

  v_history := coalesce(
    v_submission.submission_data #> '{previousEmploymentDetails,employmentHistory}',
    v_submission.submission_data #> '{previousEmploymentDetails,employment_history}'
  );

  IF jsonb_typeof(v_history) IS DISTINCT FROM 'array'
     OR jsonb_array_length(v_history) = 0 THEN
    RAISE EXCEPTION 'No previous employment history was found in this submission.';
  END IF;

  v_previous_status := v_submission.employment_verification_status;

  IF p_decision = 'verify' THEN
    UPDATE public.joining_onboarding_submissions
    SET
      employment_verification_status = 'verified',
      employment_verified_at = now(),
      employment_verified_by = p_actor_user_id,
      employment_review_notes = v_notes,
      employment_correction_instructions = NULL,
      updated_at = now()
    WHERE id = p_expected_submission_id;

    v_event_type := 'employment_details_verified';
  ELSE
    UPDATE public.joining_onboarding_submissions
    SET
      employment_verification_status = 'correction_required',
      employment_verified_at = NULL,
      employment_verified_by = NULL,
      employment_review_notes = v_notes,
      employment_correction_instructions = v_candidate_instruction,
      updated_at = now()
    WHERE id = p_expected_submission_id;

    v_event_type := 'employment_details_correction_required';
  END IF;

  INSERT INTO public.joining_onboarding_events (
    candidate_id,
    submission_id,
    actor_type,
    actor_user_id,
    event_type,
    event_details
  )
  VALUES (
    p_candidate_id,
    p_expected_submission_id,
    lower(p_actor_type),
    p_actor_user_id,
    v_event_type,
    jsonb_build_object(
      'previous_status', v_previous_status,
      'new_status',
        CASE
          WHEN p_decision = 'verify' THEN 'verified'
          ELSE 'correction_required'
        END,
      'review_notes', v_notes,
      'candidate_instruction', v_candidate_instruction
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'candidate_id', p_candidate_id,
    'submission_id', p_expected_submission_id,
    'employment_verification_status',
      CASE
        WHEN p_decision = 'verify' THEN 'verified'
        ELSE 'correction_required'
      END
  );
END;
$$;


--
-- Name: review_candidate_employment_document(uuid, uuid, uuid, uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.review_candidate_employment_document(p_candidate_id uuid, p_expected_submission_id uuid, p_document_id uuid, p_actor_user_id uuid, p_actor_type text, p_decision text, p_candidate_instruction text, p_review_reason text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_candidate public.joining_candidates%ROWTYPE;
  v_submission public.joining_onboarding_submissions%ROWTYPE;
  v_document public.joining_onboarding_documents%ROWTYPE;
  v_reason text;
  v_candidate_instruction text;
  v_event_type text;
  v_previous_status text;
  v_new_status text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role access required.';
  END IF;

  IF p_actor_user_id IS NULL
     OR lower(coalesce(p_actor_type, '')) NOT IN ('hr', 'ceo') THEN
    RAISE EXCEPTION 'A valid HR or CEO actor is required.';
  END IF;

  IF p_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid document review decision.';
  END IF;

  v_reason := nullif(btrim(coalesce(p_review_reason, '')), '');
  v_candidate_instruction :=
    nullif(btrim(coalesce(p_candidate_instruction, '')), '');

  IF p_decision = 'reject'
     AND v_candidate_instruction IS NULL THEN
    RAISE EXCEPTION 'Candidate correction instructions are required.';
  END IF;

  IF length(coalesce(v_reason, '')) > 2000 THEN
    RAISE EXCEPTION 'Review reason cannot exceed 2000 characters.';
  END IF;

  IF length(coalesce(v_candidate_instruction, '')) > 2000 THEN
    RAISE EXCEPTION 'Candidate correction instructions cannot exceed 2000 characters.';
  END IF;

  SELECT *
  INTO v_candidate
  FROM public.joining_candidates
  WHERE id = p_candidate_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Joining candidate not found.';
  END IF;

  IF NOT (
       v_candidate.status = 'offer_accepted'
       OR (
         v_candidate.status = 'joining_letter_sent'
         AND v_candidate.onboarding_verification_reopened_at IS NOT NULL
       )
     )
     OR v_candidate.onboarding_submission_id
        IS DISTINCT FROM p_expected_submission_id
     OR v_candidate.conversion_status IN ('processing', 'completed')
     OR v_candidate.employee_record_id IS NOT NULL THEN
    RAISE EXCEPTION 'Candidate is no longer eligible for document review.';
  END IF;

  IF v_candidate.onboarding_status <> 'submitted' THEN
    RAISE EXCEPTION 'Candidate onboarding must be submitted before document review.';
  END IF;

  SELECT *
  INTO v_submission
  FROM public.joining_onboarding_submissions
  WHERE id = p_expected_submission_id
    AND candidate_id = p_candidate_id
  FOR UPDATE;

  IF NOT FOUND OR v_submission.status <> 'submitted' THEN
    RAISE EXCEPTION 'The active onboarding submission is not available for review.';
  END IF;

  SELECT *
  INTO v_document
  FROM public.joining_onboarding_documents
  WHERE id = p_document_id
    AND candidate_id = p_candidate_id
    AND submission_id = p_expected_submission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employment document not found in the active submission.';
  END IF;

  IF v_document.document_type NOT IN (
    'experience_document',
    'relieving_letter'
  ) THEN
    RAISE EXCEPTION 'This review action is only allowed for previous-employment documents.';
  END IF;

  -- Prevent reviewing an older employment-document upload.
  IF EXISTS (
    SELECT 1
    FROM public.joining_onboarding_documents newer
    WHERE newer.candidate_id = v_document.candidate_id
      AND newer.document_type = v_document.document_type
      AND newer.employment_record_id
          IS NOT DISTINCT FROM v_document.employment_record_id
      AND (
        newer.version > v_document.version
        OR (
          newer.version = v_document.version
          AND newer.uploaded_at > v_document.uploaded_at
        )
      )
  ) THEN
    RAISE EXCEPTION 'A newer employment document version exists. Please review the latest upload.';
  END IF;

  IF v_document.verification_status NOT IN (
    'pending',
    'resubmission_required'
  ) THEN
    RAISE EXCEPTION 'This document has already been reviewed.';
  END IF;

  v_previous_status := v_document.verification_status;

  IF p_decision = 'approve' THEN
    v_new_status := 'approved';
    v_event_type := 'employment_document_approved';
  ELSE
    v_new_status := 'rejected';
    v_event_type := 'employment_document_rejected';
  END IF;

  UPDATE public.joining_onboarding_documents
  SET
    verification_status = v_new_status,
    reviewed_at = now(),
    reviewed_by = p_actor_user_id,
    review_reason = v_reason,
    correction_instructions = CASE
      WHEN p_decision = 'reject' THEN v_candidate_instruction
      ELSE NULL
    END
  WHERE id = p_document_id;

  INSERT INTO public.joining_onboarding_events (
    candidate_id,
    submission_id,
    actor_type,
    actor_user_id,
    event_type,
    event_details
  )
  VALUES (
    p_candidate_id,
    p_expected_submission_id,
    lower(p_actor_type),
    p_actor_user_id,
    v_event_type,
    jsonb_build_object(
      'document_id', p_document_id,
      'document_type', v_document.document_type,
      'file_name', v_document.original_file_name,
      'previous_status', v_previous_status,
      'new_status', v_new_status,
      'review_reason', v_reason,
      'candidate_instruction', v_candidate_instruction
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'candidate_id', p_candidate_id,
    'submission_id', p_expected_submission_id,
    'document_id', p_document_id,
    'verification_status', v_new_status
  );
END;
$$;


--
-- Name: review_candidate_onboarding_document(uuid, uuid, uuid, uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.review_candidate_onboarding_document(p_candidate_id uuid, p_expected_submission_id uuid, p_document_id uuid, p_actor_user_id uuid, p_actor_type text, p_decision text, p_candidate_instruction text, p_review_reason text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_candidate public.joining_candidates%ROWTYPE;
  v_submission public.joining_onboarding_submissions%ROWTYPE;
  v_document public.joining_onboarding_documents%ROWTYPE;
  v_reason text;
  v_candidate_instruction text;
  v_event_type text;
  v_previous_status text;
  v_new_status text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role access required.';
  END IF;

  IF p_actor_user_id IS NULL
     OR lower(coalesce(p_actor_type, '')) NOT IN ('hr', 'ceo') THEN
    RAISE EXCEPTION 'A valid HR or CEO actor is required.';
  END IF;

  IF coalesce(p_decision, '') NOT IN (
    'approve',
    'reject',
    'request_resubmission'
  ) THEN
    RAISE EXCEPTION 'Invalid document review decision.';
  END IF;

  v_reason := nullif(btrim(coalesce(p_review_reason, '')), '');
  v_candidate_instruction :=
    nullif(btrim(coalesce(p_candidate_instruction, '')), '');

  IF p_decision IN ('reject', 'request_resubmission')
     AND v_candidate_instruction IS NULL THEN
    RAISE EXCEPTION 'Candidate correction instructions are required.';
  END IF;

  IF length(coalesce(v_reason, '')) > 2000 THEN
    RAISE EXCEPTION 'Review reason cannot exceed 2000 characters.';
  END IF;

  IF length(coalesce(v_candidate_instruction, '')) > 2000 THEN
    RAISE EXCEPTION 'Candidate correction instructions cannot exceed 2000 characters.';
  END IF;

  SELECT *
  INTO v_candidate
  FROM public.joining_candidates
  WHERE id = p_candidate_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Joining candidate not found.';
  END IF;

  IF NOT (
       v_candidate.status = 'offer_accepted'
       OR (
         v_candidate.status = 'joining_letter_sent'
         AND v_candidate.onboarding_verification_reopened_at IS NOT NULL
       )
     )
     OR v_candidate.onboarding_submission_id
        IS DISTINCT FROM p_expected_submission_id
     OR v_candidate.conversion_status IN ('processing', 'completed')
     OR v_candidate.employee_record_id IS NOT NULL THEN
    RAISE EXCEPTION 'Candidate is no longer eligible for document review.';
  END IF;

  IF v_candidate.onboarding_status <> 'submitted' THEN
    RAISE EXCEPTION 'Candidate onboarding must be submitted before document review.';
  END IF;

  SELECT *
  INTO v_submission
  FROM public.joining_onboarding_submissions
  WHERE id = p_expected_submission_id
    AND candidate_id = p_candidate_id
  FOR UPDATE;

  IF NOT FOUND OR v_submission.status <> 'submitted' THEN
    RAISE EXCEPTION 'The active onboarding submission is not available for review.';
  END IF;

  SELECT *
  INTO v_document
  FROM public.joining_onboarding_documents
  WHERE id = p_document_id
    AND candidate_id = p_candidate_id
    AND submission_id = p_expected_submission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found in the active onboarding submission.';
  END IF;

  -- Do not review an older version when a newer upload exists.
  IF EXISTS (
    SELECT 1
    FROM public.joining_onboarding_documents newer
    WHERE newer.candidate_id = v_document.candidate_id
      AND newer.document_type = v_document.document_type
      AND newer.employment_record_id
          IS NOT DISTINCT FROM v_document.employment_record_id
      AND (
        newer.version > v_document.version
        OR (
          newer.version = v_document.version
          AND newer.uploaded_at > v_document.uploaded_at
        )
      )
  ) THEN
    RAISE EXCEPTION 'A newer document version exists. Please review the latest upload.';
  END IF;

  v_previous_status := v_document.verification_status;

  IF p_decision = 'request_resubmission' THEN

    -- This action is exclusively for an already-approved document.
    IF v_document.verification_status <> 'approved' THEN
      RAISE EXCEPTION 'Resubmission can only be requested for an approved document.';
    END IF;

    IF v_document.resubmission_requested_at IS NOT NULL THEN
      RAISE EXCEPTION 'A resubmission request already exists for this document.';
    END IF;

    UPDATE public.joining_onboarding_documents
    SET
      resubmission_requested_at = now(),
      resubmission_requested_by = p_actor_user_id,
      resubmission_instructions = v_candidate_instruction
    WHERE id = p_document_id;

    v_new_status := 'approved';
    v_event_type := 'onboarding_document_resubmission_requested';

  ELSE

    IF v_document.verification_status NOT IN (
      'pending',
      'resubmission_required'
    ) THEN
      RAISE EXCEPTION 'This document has already been reviewed.';
    END IF;

    IF p_decision = 'approve' THEN
      v_new_status := 'approved';
      v_event_type := 'onboarding_document_approved';
    ELSE
      v_new_status := 'rejected';
      v_event_type := 'onboarding_document_rejected';
    END IF;

    UPDATE public.joining_onboarding_documents
    SET
      verification_status = v_new_status,
      reviewed_at = now(),
      reviewed_by = p_actor_user_id,
      review_reason = v_reason,
      correction_instructions = CASE
        WHEN p_decision = 'reject' THEN v_candidate_instruction
        ELSE NULL
      END
    WHERE id = p_document_id;

  END IF;

  INSERT INTO public.joining_onboarding_events (
    candidate_id,
    submission_id,
    actor_type,
    actor_user_id,
    event_type,
    event_details
  )
  VALUES (
    p_candidate_id,
    p_expected_submission_id,
    lower(p_actor_type),
    p_actor_user_id,
    v_event_type,
    jsonb_build_object(
      'document_id', p_document_id,
      'document_type', v_document.document_type,
      'file_name', v_document.original_file_name,
      'previous_status', v_previous_status,
      'new_status', v_new_status,
      'review_reason', v_reason,
      'candidate_instruction', v_candidate_instruction,
      'resubmission_requested',
        (p_decision = 'request_resubmission')
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'candidate_id', p_candidate_id,
    'submission_id', p_expected_submission_id,
    'document_id', p_document_id,
    'verification_status', v_new_status,
    'resubmission_requested',
      (p_decision = 'request_resubmission')
  );
END;
$$;


--
-- Name: review_candidate_onboarding_section(uuid, uuid, text, uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.review_candidate_onboarding_section(p_candidate_id uuid, p_expected_submission_id uuid, p_section_key text, p_actor_user_id uuid, p_actor_type text, p_decision text, p_candidate_instruction text, p_review_notes text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_candidate public.joining_candidates%ROWTYPE;
  v_submission public.joining_onboarding_submissions%ROWTYPE;
  v_notes text;
  v_candidate_instruction text;
  v_previous_status text;
  v_new_status text;
  v_event_type text;
  v_status_column text;
  v_reviewed_at_column text;
  v_reviewed_by_column text;
  v_notes_column text;
  v_instruction_column text;
  v_section_data jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role access required.';
  END IF;

  IF p_actor_user_id IS NULL
     OR lower(coalesce(p_actor_type, '')) NOT IN ('hr', 'ceo') THEN
    RAISE EXCEPTION 'A valid HR or CEO actor is required.';
  END IF;

  IF p_section_key NOT IN (
    'personal',
    'address',
    'bank',
    'identity',
    'education',
    'emergency'
  ) THEN
    RAISE EXCEPTION 'Invalid onboarding section.';
  END IF;

  IF p_decision NOT IN ('verify', 'correction_required') THEN
    RAISE EXCEPTION 'Invalid section verification decision.';
  END IF;

  v_notes := nullif(btrim(coalesce(p_review_notes, '')), '');
  v_candidate_instruction :=
    nullif(btrim(coalesce(p_candidate_instruction, '')), '');

  IF p_decision = 'correction_required'
     AND v_candidate_instruction IS NULL THEN
    RAISE EXCEPTION 'Candidate correction instructions are required.';
  END IF;

  IF length(coalesce(v_notes, '')) > 2000 THEN
    RAISE EXCEPTION 'Review notes cannot exceed 2000 characters.';
  END IF;

  IF length(coalesce(v_candidate_instruction, '')) > 2000 THEN
    RAISE EXCEPTION 'Candidate correction instructions cannot exceed 2000 characters.';
  END IF;

  SELECT *
  INTO v_candidate
  FROM public.joining_candidates
  WHERE id = p_candidate_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Joining candidate not found.';
  END IF;

  IF 
NOT (
       v_candidate.status = 'offer_accepted'
       OR (
         v_candidate.status = 'joining_letter_sent'
         AND v_candidate.onboarding_verification_reopened_at IS NOT NULL
       )
     )

     OR v_candidate.onboarding_submission_id
        IS DISTINCT FROM p_expected_submission_id
     OR v_candidate.conversion_status IN ('processing', 'completed')
     OR v_candidate.employee_record_id IS NOT NULL THEN
    RAISE EXCEPTION 'Candidate is no longer eligible for onboarding review.';
  END IF;

  IF v_candidate.onboarding_status <> 'submitted' THEN
    RAISE EXCEPTION 'Candidate onboarding must be submitted before review.';
  END IF;

  SELECT *
  INTO v_submission
  FROM public.joining_onboarding_submissions
  WHERE id = p_expected_submission_id
    AND candidate_id = p_candidate_id
  FOR UPDATE;

  IF NOT FOUND OR v_submission.status <> 'submitted' THEN
    RAISE EXCEPTION 'The active onboarding submission is not available for review.';
  END IF;

  CASE p_section_key
    WHEN 'personal' THEN
      v_section_data := v_submission.submission_data -> 'personalDetails';
    WHEN 'address' THEN
      v_section_data := v_submission.submission_data -> 'addressDetails';
    WHEN 'bank' THEN
      v_section_data := v_submission.submission_data -> 'bankDetails';
    WHEN 'identity' THEN
      v_section_data := v_submission.submission_data -> 'identityDetails';
    WHEN 'education' THEN
      v_section_data := v_submission.submission_data -> 'educationDetails';
    WHEN 'emergency' THEN
      v_section_data := v_submission.submission_data -> 'emergencyContacts';
  END CASE;

  IF p_section_key = 'emergency' THEN
    IF jsonb_typeof(v_section_data) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Emergency contact details are missing.';
    END IF;

    IF jsonb_array_length(v_section_data) = 0 THEN
      RAISE EXCEPTION 'At least one emergency contact is required.';
    END IF;
  ELSE
    IF jsonb_typeof(v_section_data) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'The submitted section details are missing.';
    END IF;
  END IF;

  v_status_column := p_section_key || '_verification_status';
  v_reviewed_at_column := p_section_key || '_verified_at';
  v_reviewed_by_column := p_section_key || '_verified_by';
  v_notes_column := p_section_key || '_review_notes';
  v_instruction_column := p_section_key || '_correction_instructions';

  v_previous_status := CASE p_section_key
    WHEN 'personal' THEN v_submission.personal_verification_status
    WHEN 'address' THEN v_submission.address_verification_status
    WHEN 'bank' THEN v_submission.bank_verification_status
    WHEN 'identity' THEN v_submission.identity_verification_status
    WHEN 'education' THEN v_submission.education_verification_status
    WHEN 'emergency' THEN v_submission.emergency_verification_status
  END;

  IF p_decision = 'verify' THEN
    v_new_status := 'verified';
    v_event_type := 'onboarding_section_verified';
  ELSE
    v_new_status := 'correction_required';
    v_event_type := 'onboarding_section_correction_required';
  END IF;

  EXECUTE format(
    'UPDATE public.joining_onboarding_submissions
     SET %I = $1,
         %I = now(),
         %I = $2,
         %I = $3,
         %I = $4,
         updated_at = now()
     WHERE id = $5 AND candidate_id = $6',
    v_status_column,
    v_reviewed_at_column,
    v_reviewed_by_column,
    v_notes_column,
    v_instruction_column
  )
  USING
    v_new_status,
    p_actor_user_id,
    v_notes,
    CASE
      WHEN p_decision = 'correction_required'
      THEN v_candidate_instruction
      ELSE NULL
    END,
    p_expected_submission_id,
    p_candidate_id;

  INSERT INTO public.joining_onboarding_events (
    candidate_id,
    submission_id,
    actor_type,
    actor_user_id,
    event_type,
    event_details
  )
  VALUES (
    p_candidate_id,
    p_expected_submission_id,
    lower(p_actor_type),
    p_actor_user_id,
    v_event_type,
    jsonb_build_object(
      'section_key', p_section_key,
      'previous_status', v_previous_status,
      'new_status', v_new_status,
      'review_notes', v_notes,
      'candidate_instruction', v_candidate_instruction
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'candidate_id', p_candidate_id,
    'submission_id', p_expected_submission_id,
    'section_key', p_section_key,
    'verification_status', v_new_status
  );
END;
$_$;


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
-- Name: review_leave_request_atomic(uuid, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.review_leave_request_atomic(p_request_id uuid, p_status text, p_reviewer_id uuid, p_rejection_reason text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_req RECORD;
  v_leave_type RECORD;
  v_balance RECORD;

  v_start_date date;
  v_end_date date;
  v_year integer;

  v_total_calendar_days integer;
  v_overlapping_days integer;

  v_requested_days numeric;
  v_days_for_year numeric;

  v_leave_code text;
  v_leave_name text;

  v_is_lop boolean;
  v_is_special boolean;
BEGIN
  -- Validate requested status.
  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid leave review status.';
  END IF;

  -- Lock the leave request.
  -- A second HR request must wait until the first transaction finishes.
  SELECT *
  INTO v_req
  FROM public.leave_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leave request not found.';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION
      'Leave request has already been reviewed. Current status: %',
      v_req.status;
  END IF;

  v_start_date := v_req.start_date;
  v_end_date := v_req.end_date;
  v_requested_days := COALESCE(v_req.total_days, 0);

  IF v_start_date IS NULL
     OR v_end_date IS NULL
     OR v_end_date < v_start_date THEN
    RAISE EXCEPTION 'Invalid leave request dates.';
  END IF;

  v_total_calendar_days :=
    (v_end_date - v_start_date) + 1;

  IF v_total_calendar_days <= 0
     OR v_requested_days <= 0 THEN
    RAISE EXCEPTION 'Invalid leave duration.';
  END IF;

  -- Balance deduction happens only for HR approval.
  IF p_status = 'approved' THEN

    SELECT id, name, code
    INTO v_leave_type
    FROM public.leave_types
    WHERE id = v_req.leave_type_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Leave type not found.';
    END IF;

    v_leave_code := upper(COALESCE(v_leave_type.code, ''));
    v_leave_name := lower(COALESCE(v_leave_type.name, ''));

    v_is_lop :=
      v_leave_code = 'LOP'
      OR v_leave_name LIKE '%loss of pay%';

    v_is_special :=
      v_leave_code IN ('ML', 'PL')
      OR v_leave_name LIKE '%maternity%'
      OR v_leave_name LIKE '%paternity%';

    -- Validate half-day requests.
    IF COALESCE(v_req.is_half_day, false) THEN
      IF v_start_date <> v_end_date
         OR v_requested_days <> 0.5
         OR v_is_special THEN
        RAISE EXCEPTION 'Invalid half-day leave duration.';
      END IF;
    ELSE
      IF v_requested_days <> v_total_calendar_days THEN
        RAISE EXCEPTION
          'Invalid leave duration. Expected % calendar days, but request contains %.',
          v_total_calendar_days,
          v_requested_days;
      END IF;
    END IF;

    -- LOP, ML and PL do not deduct normal leave balances.
    IF NOT v_is_lop AND NOT v_is_special THEN

      -- Process each calendar year separately.
      FOR v_year IN
        SELECT generate_series(
          EXTRACT(YEAR FROM v_start_date)::integer,
          EXTRACT(YEAR FROM v_end_date)::integer
        )
      LOOP
        v_overlapping_days :=
          (
            LEAST(
              v_end_date,
              make_date(v_year, 12, 31)
            )
            -
            GREATEST(
              v_start_date,
              make_date(v_year, 1, 1)
            )
          ) + 1;

        v_days_for_year := ROUND(
          (
            v_requested_days * v_overlapping_days
          ) / v_total_calendar_days,
          2
        );

        IF v_days_for_year <= 0 THEN
          CONTINUE;
        END IF;

        -- Lock the employee's balance row.
        SELECT *
        INTO v_balance
        FROM public.employee_leave_balances
        WHERE employee_id = v_req.employee_id
          AND leave_type_id = v_req.leave_type_id
          AND year = v_year
        FOR UPDATE;

        IF NOT FOUND THEN
          RAISE EXCEPTION
            'Leave balance not found for %, year %.',
            v_leave_type.name,
            v_year;
        END IF;

        IF COALESCE(v_balance.balance_days, 0)
           < v_days_for_year THEN
          RAISE EXCEPTION
            'Insufficient leave balance for %. Available: %, Requested: %.',
            v_year,
            COALESCE(v_balance.balance_days, 0),
            v_days_for_year;
        END IF;

        -- Deduct balance and update used days.
        UPDATE public.employee_leave_balances
        SET
          used_days = ROUND(
            COALESCE(used_days, 0) + v_days_for_year,
            2
          ),
          balance_days = ROUND(
            COALESCE(balance_days, 0) - v_days_for_year,
            2
          )
        WHERE id = v_balance.id;

      END LOOP;
    END IF;
  END IF;

  -- Update the leave request inside the same transaction.
  UPDATE public.leave_requests
  SET
    status = p_status,
    reviewed_by = p_reviewer_id,
    reviewed_at = NOW(),
    rejection_reason = CASE
      WHEN p_status = 'rejected'
      THEN NULLIF(TRIM(p_rejection_reason), '')
      ELSE NULL
    END
  WHERE id = p_request_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leave request was already reviewed.';
  END IF;

  RETURN TRUE;
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
    v_certification boolean := false;

    v_bank_name text;
    v_account_number text;
    v_ifsc text;
    v_aadhaar_number text;
    v_pan_number text;
    v_passport_number text;

BEGIN
    -- --------------------------------------------------
    -- VALIDATE DECISION AND REVIEW NOTES
    -- --------------------------------------------------

    IF v_decision NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Decision must be approved or rejected.';
    END IF;

    IF length(coalesce(v_notes, '')) > 2000 THEN
        RAISE EXCEPTION 'Review notes cannot exceed 2000 characters.';
    END IF;

    IF v_decision = 'rejected' AND v_notes IS NULL THEN
        RAISE EXCEPTION 'Please provide a reason for rejection.';
    END IF;

    -- --------------------------------------------------
    -- VERIFY HR / CEO
    -- --------------------------------------------------

    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized.';
    END IF;

    SELECT lower(trim(p.role))
    INTO v_role
    FROM public.profiles p
    WHERE p.id = v_user_id;

    IF v_role NOT IN ('hr', 'ceo') OR v_role IS NULL THEN
        RAISE EXCEPTION
            'Only HR and CEO can review profile-change requests.';
    END IF;

    -- --------------------------------------------------
    -- LOCK REQUEST
    -- --------------------------------------------------

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
        RAISE EXCEPTION
            'This profile-change request has already been reviewed.';
    END IF;

    IF v_request.employee_id IS NULL THEN
        RAISE EXCEPTION
            'The profile-change request has no employee.';
    END IF;

    v_changes := coalesce(v_request.requested_changes, '{}'::jsonb);

    IF jsonb_typeof(v_changes) <> 'object' THEN
        RAISE EXCEPTION
            'Requested changes must be a JSON object.';
    END IF;

    -- --------------------------------------------------
    -- VALIDATE COMPLETE FIELD ALLOWLIST
    -- --------------------------------------------------

    FOR v_key IN
        SELECT jsonb_object_keys(v_changes)
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

            WHEN 'professional_certification_name'
                THEN 'professional_certification_name'

            WHEN 'professional_certification_organization'
                THEN 'professional_certification_organization'

            WHEN 'professional_certification_credential_id'
                THEN 'professional_certification_credential_id'

            WHEN 'professional_certification_issue_date'
                THEN 'professional_certification_issue_date'

            WHEN 'professional_certification_expiry_date'
                THEN 'professional_certification_expiry_date'

            WHEN 'technical_skills' THEN 'technical_skills'

            ELSE NULL
        END;

        IF v_column IS NULL THEN
            RAISE EXCEPTION
                'Unsupported profile field: %', v_key;
        END IF;

        IF v_key IN (
            'bank_name',
            'bank_account_number',
            'ifsc_code',
            'pan_number',
            'aadhar_number',
            'aadhaar_number',
            'passport_number'
        ) THEN
            v_sensitive := true;
        END IF;

        IF v_key = 'professional_certification_name' THEN
            IF jsonb_typeof(v_changes->v_key) NOT IN ('string', 'null') THEN
                RAISE EXCEPTION
                    'Professional certification name must be text.';
            END IF;

            IF nullif(trim(v_changes->>v_key), '') IS NOT NULL THEN
                v_certification := true;
            END IF;
        END IF;

        IF v_key IN (
            'professional_certification_organization',
            'professional_certification_credential_id'
        ) THEN
            IF jsonb_typeof(v_changes->v_key) IS DISTINCT FROM 'string'
               AND jsonb_typeof(v_changes->v_key) IS DISTINCT FROM 'null' THEN
                RAISE EXCEPTION
                    'Professional certification details must be text.';
            END IF;
        END IF;

        IF v_key IN (
            'professional_certification_issue_date',
            'professional_certification_expiry_date'
        ) THEN
            IF jsonb_typeof(v_changes->v_key) IS DISTINCT FROM 'string'
               AND jsonb_typeof(v_changes->v_key) IS DISTINCT FROM 'null' THEN
                RAISE EXCEPTION
                    'Professional certification dates must be text or null.';
            END IF;

            IF nullif(trim(v_changes->>v_key), '') IS NOT NULL THEN
                PERFORM (v_changes->>v_key)::date;
            END IF;
        END IF;

        IF v_key = 'technical_skills' THEN
            IF jsonb_typeof(v_changes->v_key) IS DISTINCT FROM 'array' THEN
                RAISE EXCEPTION
                    'Technical skills must be a JSON array.';
            END IF;

            IF EXISTS (
                SELECT 1
                FROM jsonb_array_elements(v_changes->v_key) AS skill(value)
                WHERE jsonb_typeof(skill.value) <> 'string'
            ) THEN
                RAISE EXCEPTION
                    'Every technical skill must be text.';
            END IF;
        END IF;
    END LOOP;

    -- --------------------------------------------------
    -- REJECTION
    -- --------------------------------------------------

    IF v_decision = 'rejected' THEN

        -- Reject linked sensitive documents.
        UPDATE public.employee_documents d
        SET verification_status = 'rejected',
            profile_change_approved = false,
            reviewed_by = v_user_id,
            reviewed_at = now(),
            review_notes = v_notes
        WHERE d.employee_id = v_request.employee_id
          AND d.profile_change_request_id = p_request_id
          AND lower(trim(coalesce(d.document_type, ''))) IN (
              'aadhaar card',
              'aadhar card',
              'aadhaar',
              'aadhar',
              'pan card',
              'passport',
              'bank passbook'
          )
          AND d.verification_status IN ('pending', 'verified');

        -- Reject linked professional certification documents.
        UPDATE public.employee_documents d
        SET verification_status = 'rejected',
            profile_change_approved = false,
            reviewed_by = v_user_id,
            reviewed_at = now(),
            review_notes = v_notes
        WHERE d.employee_id = v_request.employee_id
          AND d.profile_change_request_id = p_request_id
          AND lower(trim(coalesce(d.document_type, '')))
              = 'professional certification'
          AND d.verification_status IN ('pending', 'verified');

        -- Do not modify employee profile values on rejection.
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

    -- --------------------------------------------------
    -- APPROVAL: VALIDATE SENSITIVE DOCUMENTS
    -- --------------------------------------------------

    IF v_changes ?| ARRAY[
        'bank_name',
        'bank_account_number',
        'ifsc_code'
    ] THEN
        v_bank := true;

        IF NOT EXISTS (
            SELECT 1
            FROM public.employee_documents d
            WHERE d.employee_id = v_request.employee_id
              AND d.profile_change_request_id = p_request_id
              AND lower(trim(coalesce(d.document_type, '')))
                  = 'bank passbook'
              AND d.verification_status IN ('pending', 'verified')
        ) THEN
            RAISE EXCEPTION
                'Bank-field changes require a linked Bank Passbook with pending or verified status.';
        END IF;
    END IF;

    IF v_changes ?| ARRAY[
        'aadhar_number',
        'aadhaar_number'
    ] THEN
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
            RAISE EXCEPTION
                'Aadhaar changes require a linked Aadhaar document with pending or verified status.';
        END IF;
    END IF;

    IF v_changes ? 'pan_number' THEN
        v_pan := true;

        IF NOT EXISTS (
            SELECT 1
            FROM public.employee_documents d
            WHERE d.employee_id = v_request.employee_id
              AND d.profile_change_request_id = p_request_id
              AND lower(trim(coalesce(d.document_type, '')))
                  = 'pan card'
              AND d.verification_status IN ('pending', 'verified')
        ) THEN
            RAISE EXCEPTION
                'PAN changes require a linked PAN Card with pending or verified status.';
        END IF;
    END IF;

    IF v_changes ? 'passport_number' THEN
        v_passport := true;

        IF NOT EXISTS (
            SELECT 1
            FROM public.employee_documents d
            WHERE d.employee_id = v_request.employee_id
              AND d.profile_change_request_id = p_request_id
              AND lower(trim(coalesce(d.document_type, '')))
                  = 'passport'
              AND d.verification_status IN ('pending', 'verified')
        ) THEN
            RAISE EXCEPTION
                'Passport changes require a linked Passport with pending or verified status.';
        END IF;
    END IF;

    -- --------------------------------------------------
    -- PROFESSIONAL CERTIFICATION VALIDATION
    -- --------------------------------------------------

    IF v_certification THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.employee_documents d
            WHERE d.employee_id = v_request.employee_id
              AND d.profile_change_request_id = p_request_id
              AND lower(trim(coalesce(d.document_type, '')))
                  = 'professional certification'
              AND d.verification_status IN ('pending', 'verified')
        ) THEN
            RAISE EXCEPTION
                'Professional certification changes require a linked certification document with pending or verified status.';
        END IF;
    END IF;

    -- --------------------------------------------------
    -- LOCK AND VALIDATE SENSITIVE DOCUMENTS
    -- --------------------------------------------------

    FOR v_document IN
        SELECT *
        FROM public.employee_documents d
        WHERE d.employee_id = v_request.employee_id
          AND d.profile_change_request_id = p_request_id
          AND lower(trim(coalesce(d.document_type, ''))) IN (
              'aadhaar card',
              'aadhar card',
              'aadhaar',
              'aadhar',
              'pan card',
              'passport',
              'bank passbook'
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
                'aadhar_number',
                'aadhaar_number',
                'pan_number',
                'passport_number'
            ] THEN
                RAISE EXCEPTION
                    'Bank Passbook cannot verify identity-number changes.';
            END IF;

            IF v_changes ? 'bank_name'
               AND (
                   v_document.bank_name IS NULL
                   OR v_changes->>'bank_name'
                      IS DISTINCT FROM v_document.bank_name
               ) THEN
                RAISE EXCEPTION
                    'Requested bank name does not match the linked document.';
            END IF;

            IF v_changes ? 'bank_account_number'
               AND (
                   v_document.bank_account_number IS NULL
                   OR v_changes->>'bank_account_number'
                      IS DISTINCT FROM v_document.bank_account_number
               ) THEN
                RAISE EXCEPTION
                    'Requested account number does not match the linked document.';
            END IF;

            IF v_changes ? 'ifsc_code'
               AND (
                   v_document.ifsc_code IS NULL
                   OR v_changes->>'ifsc_code'
                      IS DISTINCT FROM v_document.ifsc_code
               ) THEN
                RAISE EXCEPTION
                    'Requested IFSC does not match the linked document.';
            END IF;

            IF NOT (v_changes ?| ARRAY[
                'bank_name',
                'bank_account_number',
                'ifsc_code'
            ]) THEN
                RAISE EXCEPTION
                    'Bank Passbook is not linked to a requested bank-field change.';
            END IF;

        ELSIF v_type IN (
            'aadhaar card',
            'aadhar card',
            'aadhaar',
            'aadhar'
        ) THEN

            IF NOT (
                v_changes ? 'aadhar_number'
                OR v_changes ? 'aadhaar_number'
            )
            OR v_document.aadhaar_number IS NULL
            OR coalesce(
                v_changes->>'aadhar_number',
                v_changes->>'aadhaar_number'
            ) IS DISTINCT FROM v_document.aadhaar_number THEN
                RAISE EXCEPTION
                    'Request does not match the linked Aadhaar number.';
            END IF;

        ELSIF v_type = 'pan card' THEN

            IF NOT (v_changes ? 'pan_number')
               OR v_document.pan_number IS NULL
               OR v_changes->>'pan_number'
                  IS DISTINCT FROM v_document.pan_number THEN
                RAISE EXCEPTION
                    'Request does not match the linked PAN number.';
            END IF;

        ELSIF v_type = 'passport' THEN

            IF NOT (v_changes ? 'passport_number')
               OR v_document.passport_number IS NULL
               OR v_changes->>'passport_number'
                  IS DISTINCT FROM v_document.passport_number THEN
                RAISE EXCEPTION
                    'Request does not match the linked passport number.';
            END IF;

        END IF;
    END LOOP;

    IF v_sensitive AND NOT EXISTS (
        SELECT 1
        FROM public.employee_documents d
        WHERE d.employee_id = v_request.employee_id
          AND d.profile_change_request_id = p_request_id
          AND lower(trim(coalesce(d.document_type, ''))) IN (
              'aadhaar card',
              'aadhar card',
              'aadhaar',
              'aadhar',
              'pan card',
              'passport',
              'bank passbook'
          )
          AND d.verification_status IN ('pending', 'verified')
    ) THEN
        RAISE EXCEPTION
            'Sensitive profile changes require linked eligible supporting documents.';
    END IF;

    -- --------------------------------------------------
    -- UPDATE ORDINARY PROFILE FIELDS
    -- --------------------------------------------------

    FOR v_key IN
        SELECT jsonb_object_keys(v_changes)
    LOOP
        IF v_key IN (
            'bank_name',
            'bank_account_number',
            'ifsc_code',
            'pan_number',
            'aadhar_number',
            'aadhaar_number',
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

            WHEN 'professional_certification_name'
                THEN 'professional_certification_name'

            WHEN 'professional_certification_organization'
                THEN 'professional_certification_organization'

            WHEN 'professional_certification_credential_id'
                THEN 'professional_certification_credential_id'

            WHEN 'professional_certification_issue_date'
                THEN 'professional_certification_issue_date'

            WHEN 'professional_certification_expiry_date'
                THEN 'professional_certification_expiry_date'

            WHEN 'technical_skills' THEN 'technical_skills'

            ELSE NULL
        END;

        IF v_column IS NULL THEN
            RAISE EXCEPTION
                'Unsupported profile field: %', v_key;
        END IF;

        v_value := v_changes->v_key;

        -- Date fields.
        IF v_column IN (
            'date_of_birth',
            'probation_end_date',
            'confirmation_date',
            'professional_certification_issue_date',
            'professional_certification_expiry_date'
        ) THEN

            EXECUTE format(
                'UPDATE public.employees
                 SET %I = $1::date, updated_at = now()
                 WHERE id = $2',
                v_column
            )
            USING
                nullif(v_value #>> '{}', '')::date,
                v_request.employee_id;

        -- Department UUID.
        ELSIF v_column = 'department_id' THEN

            EXECUTE
                'UPDATE public.employees
                 SET department_id = $1::uuid, updated_at = now()
                 WHERE id = $2'
            USING
                nullif(v_value #>> '{}', '')::uuid,
                v_request.employee_id;

        -- Existing JSONB peripherals.
        ELSIF v_column = 'peripherals' THEN

            EXECUTE
                'UPDATE public.employees
                 SET peripherals = $1::jsonb, updated_at = now()
                 WHERE id = $2'
            USING
                v_value,
                v_request.employee_id;

        -- Technical skills must remain JSONB.
        ELSIF v_column = 'technical_skills' THEN

            EXECUTE
                'UPDATE public.employees
                 SET technical_skills = $1::jsonb, updated_at = now()
                 WHERE id = $2'
            USING
                v_value,
                v_request.employee_id;

        -- Other text fields, including certification name.
        ELSE

            EXECUTE format(
                'UPDATE public.employees
                 SET %I = $1, updated_at = now()
                 WHERE id = $2',
                v_column
            )
            USING
                nullif(v_value #>> '{}', ''),
                v_request.employee_id;

        END IF;

        GET DIAGNOSTICS v_updated_count = ROW_COUNT;

        IF v_updated_count <> 1 THEN
            RAISE EXCEPTION
                'Could not update employee field: %', v_key;
        END IF;
    END LOOP;

    -- --------------------------------------------------
    -- APPLY SENSITIVE EMPLOYEE VALUES FROM DOCUMENTS
    -- --------------------------------------------------

    IF v_bank THEN

        SELECT
            d.bank_name,
            d.bank_account_number,
            d.ifsc_code
        INTO
            v_bank_name,
            v_account_number,
            v_ifsc
        FROM public.employee_documents d
        WHERE d.employee_id = v_request.employee_id
          AND d.profile_change_request_id = p_request_id
          AND lower(trim(coalesce(d.document_type, '')))
              = 'bank passbook'
          AND d.verification_status IN ('pending', 'verified')
        LIMIT 1;

        UPDATE public.employees
        SET bank_name = CASE
                WHEN v_changes ? 'bank_name'
                THEN v_bank_name ELSE bank_name
            END,
            bank_account_number = CASE
                WHEN v_changes ? 'bank_account_number'
                THEN v_account_number ELSE bank_account_number
            END,
            ifsc_code = CASE
                WHEN v_changes ? 'ifsc_code'
                THEN v_ifsc ELSE ifsc_code
            END,
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
          AND lower(trim(coalesce(d.document_type, '')))
              = 'pan card'
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
          AND lower(trim(coalesce(d.document_type, '')))
              = 'passport'
          AND d.verification_status IN ('pending', 'verified')
        LIMIT 1;

        UPDATE public.employees
        SET passport_number = v_passport_number,
            updated_at = now()
        WHERE id = v_request.employee_id;
    END IF;

    -- --------------------------------------------------
    -- FINALIZE LINKED SENSITIVE DOCUMENTS
    -- --------------------------------------------------

    FOR v_document IN
        SELECT *
        FROM public.employee_documents d
        WHERE d.employee_id = v_request.employee_id
          AND d.profile_change_request_id = p_request_id
          AND lower(trim(coalesce(d.document_type, ''))) IN (
              'aadhaar card',
              'aadhar card',
              'aadhaar',
              'aadhar',
              'pan card',
              'passport',
              'bank passbook'
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
                RAISE EXCEPTION
                    'The previous document could not be superseded.';
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
            RAISE EXCEPTION
                'A supporting document could not be finalized.';
        END IF;
    END LOOP;

    -- --------------------------------------------------
    -- APPROVE PROFESSIONAL CERTIFICATION DOCUMENTS
    -- --------------------------------------------------

    FOR v_document IN
        SELECT *
        FROM public.employee_documents d
        WHERE d.employee_id = v_request.employee_id
          AND d.profile_change_request_id = p_request_id
          AND lower(trim(coalesce(d.document_type, '')))
              = 'professional certification'
        FOR UPDATE
    LOOP

        IF v_document.verification_status NOT IN ('pending', 'verified') THEN
            RAISE EXCEPTION
                'Professional certification document is not eligible for approval.';
        END IF;

        -- Supersede the exact previous approved certificate, if supplied.
        IF v_document.previous_document_id IS NOT NULL THEN

            SELECT *
            INTO v_old_document
            FROM public.employee_documents old_doc
            WHERE old_doc.id = v_document.previous_document_id
              AND old_doc.employee_id = v_document.employee_id
              AND lower(trim(coalesce(old_doc.document_type, '')))
                  = 'professional certification'
              AND old_doc.verification_status = 'approved'
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION
                    'The previous approved certification document was not found.';
            END IF;

            UPDATE public.employee_documents
            SET verification_status = 'superseded',
                reviewed_by = v_user_id,
                reviewed_at = now()
            WHERE id = v_old_document.id
              AND verification_status = 'approved';

            IF NOT FOUND THEN
                RAISE EXCEPTION
                    'The previous certification document could not be superseded.';
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
            RAISE EXCEPTION
                'The professional certification document could not be approved.';
        END IF;
    END LOOP;

    -- --------------------------------------------------
    -- FINALIZE PROFILE CHANGE REQUEST
    -- --------------------------------------------------

    UPDATE public.profile_change_requests
    SET status = 'approved',
        reviewed_by = v_user_id,
        reviewed_at = now(),
        rejection_reason = NULL
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'status', 'approved',
        'certification_updated', v_certification,
        'technical_skills_updated', v_changes ? 'technical_skills'
    );

END;
$_$;


--
-- Name: review_resignation_request(uuid, uuid, text, integer, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.review_resignation_request(p_request_id uuid, p_reviewer_id uuid, p_decision text, p_notice_period_value integer DEFAULT NULL::integer, p_notice_period_unit text DEFAULT 'days'::text, p_rejection_reason text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    v_request public.resignation_requests%ROWTYPE;
    v_employee public.employees%ROWTYPE;
    v_previous_state jsonb;
    v_resignation_date DATE;
    v_planned_last_working_date DATE;
    v_notice_period_days INTEGER;
BEGIN
    IF p_decision NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Invalid resignation decision';
    END IF;

    SELECT *
    INTO v_request
    FROM public.resignation_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Resignation request not found';
    END IF;

    IF v_request.status <> 'pending' THEN
        RAISE EXCEPTION 'This resignation request has already been reviewed';
    END IF;

    IF p_decision = 'rejected' THEN
        IF NULLIF(TRIM(p_rejection_reason), '') IS NULL THEN
            RAISE EXCEPTION 'A rejection reason is required';
        END IF;

        UPDATE public.resignation_requests
        SET status = 'rejected',
            rejection_reason = TRIM(p_rejection_reason),
            reviewed_by = p_reviewer_id,
            reviewed_at = NOW(),
            updated_at = NOW()
        WHERE id = p_request_id;

        RETURN jsonb_build_object(
            'success', true,
            'decision', 'rejected',
            'request_id', p_request_id
        );
    END IF;

    IF p_notice_period_value IS NULL OR p_notice_period_value < 1 THEN
        RAISE EXCEPTION 'A valid approved notice period is required';
    END IF;

    v_resignation_date := v_request.resignation_date;

    IF p_notice_period_unit = 'days' THEN
        IF p_notice_period_value > 365 THEN
            RAISE EXCEPTION 'Notice period cannot exceed 365 days';
        END IF;

        v_notice_period_days := p_notice_period_value;
        v_planned_last_working_date :=
            v_resignation_date + v_notice_period_days;

    ELSIF p_notice_period_unit = 'months' THEN
        IF p_notice_period_value > 12 THEN
            RAISE EXCEPTION 'Notice period cannot exceed 12 months';
        END IF;

        v_planned_last_working_date :=
            (
                v_resignation_date
                + make_interval(months => p_notice_period_value)
            )::DATE;

        v_notice_period_days :=
            v_planned_last_working_date - v_resignation_date;

    ELSE
        RAISE EXCEPTION 'Notice period unit must be days or months';
    END IF;

    -- Lock and read the employee before modifying the resignation fields.
    SELECT *
    INTO v_employee
    FROM public.employees
    WHERE id = v_request.employee_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee record not found';
    END IF;

    -- Save the original state only once, before applying resignation.
    v_previous_state := jsonb_build_object(
        'status', v_employee.status,
        'resignation_date', v_employee.resignation_date,
        'notice_period_days', v_employee.notice_period_days,
        'planned_last_working_date', v_employee.planned_last_working_date,
        'notice_status', v_employee.notice_status,
        'exit_reason', v_employee.exit_reason,
        'exit_document_url', v_employee.exit_document_url,
        'exit_document_name', v_employee.exit_document_name,
        'exit_date', v_employee.exit_date,
        'early_release_date', v_employee.early_release_date,
        'early_release_reason', v_employee.early_release_reason,
        'early_release_by', v_employee.early_release_by,
        'early_release_recorded_at', v_employee.early_release_recorded_at
    );

    UPDATE public.resignation_requests
    SET previous_employee_state = v_previous_state
    WHERE id = p_request_id
      AND previous_employee_state IS NULL;

    -- Preserve the existing resignation approval behavior.
    UPDATE public.employees
    SET status = 'on_notice',
        resignation_date = v_resignation_date,
        notice_period_days = v_notice_period_days,
        planned_last_working_date = v_planned_last_working_date,
        notice_status = 'notice_period',
        exit_reason = v_request.reason,
        exit_document_url = v_request.document_url,
        exit_document_name = v_request.document_name,
        exit_date = NULL,
        early_release_date = NULL,
        early_release_reason = NULL,
        early_release_by = NULL,
        early_release_recorded_at = NULL
    WHERE id = v_request.employee_id;

    UPDATE public.resignation_requests
    SET status = 'approved',
        reviewed_by = p_reviewer_id,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
        'success', true,
        'decision', 'approved',
        'request_id', p_request_id,
        'notice_period_days', v_notice_period_days,
        'planned_last_working_date', v_planned_last_working_date
    );
END;
$$;


--
-- Name: review_resignation_request(uuid, uuid, text, integer, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.review_resignation_request(p_request_id uuid, p_reviewer_id uuid, p_decision text, p_notice_period_value integer DEFAULT NULL::integer, p_notice_period_unit text DEFAULT 'days'::text, p_rejection_reason text DEFAULT NULL::text, p_temporary_login_days integer DEFAULT NULL::integer) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    v_request public.resignation_requests%ROWTYPE;
    v_employee public.employees%ROWTYPE;
    v_previous_state jsonb;
    v_resignation_date DATE;
    v_planned_last_working_date DATE;
    v_notice_period_days INTEGER;
    v_temporary_login_expires_at TIMESTAMPTZ;
BEGIN
    IF p_decision NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Invalid resignation decision';
    END IF;

    SELECT *
    INTO v_request
    FROM public.resignation_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Resignation request not found';
    END IF;

    IF v_request.status <> 'pending' THEN
        RAISE EXCEPTION 'This resignation request has already been reviewed';
    END IF;

    IF p_decision = 'rejected' THEN
        IF NULLIF(TRIM(p_rejection_reason), '') IS NULL THEN
            RAISE EXCEPTION 'A rejection reason is required';
        END IF;

        UPDATE public.resignation_requests
        SET status = 'rejected',
            rejection_reason = TRIM(p_rejection_reason),
            reviewed_by = p_reviewer_id,
            reviewed_at = NOW(),
            updated_at = NOW()
        WHERE id = p_request_id;

        RETURN jsonb_build_object(
            'success', true,
            'decision', 'rejected',
            'request_id', p_request_id
        );
    END IF;

    IF p_notice_period_value IS NULL OR p_notice_period_value < 1 THEN
        RAISE EXCEPTION 'A valid approved notice period is required';
    END IF;

    IF p_temporary_login_days IS NULL
       OR p_temporary_login_days < 0
       OR p_temporary_login_days > 45 THEN
        RAISE EXCEPTION 'Temporary login access must be between 0 and 45 days';
    END IF;

    v_resignation_date := v_request.resignation_date;

    IF p_notice_period_unit = 'days' THEN
        IF p_notice_period_value > 365 THEN
            RAISE EXCEPTION 'Notice period cannot exceed 365 days';
        END IF;

        v_notice_period_days := p_notice_period_value;
        v_planned_last_working_date :=
            v_resignation_date + v_notice_period_days;

    ELSIF p_notice_period_unit = 'months' THEN
        IF p_notice_period_value > 12 THEN
            RAISE EXCEPTION 'Notice period cannot exceed 12 months';
        END IF;

        v_planned_last_working_date :=
            (
                v_resignation_date
                + make_interval(months => p_notice_period_value)
            )::DATE;

        v_notice_period_days :=
            v_planned_last_working_date - v_resignation_date;

    ELSE
        RAISE EXCEPTION 'Notice period unit must be days or months';
    END IF;

    SELECT *
    INTO v_employee
    FROM public.employees
    WHERE id = v_request.employee_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee record not found';
    END IF;

    v_previous_state := jsonb_build_object(
        'status', v_employee.status,
        'resignation_date', v_employee.resignation_date,
        'notice_period_days', v_employee.notice_period_days,
        'planned_last_working_date', v_employee.planned_last_working_date,
        'notice_status', v_employee.notice_status,
        'exit_reason', v_employee.exit_reason,
        'exit_document_url', v_employee.exit_document_url,
        'exit_document_name', v_employee.exit_document_name,
        'exit_date', v_employee.exit_date,
        'early_release_date', v_employee.early_release_date,
        'early_release_reason', v_employee.early_release_reason,
        'early_release_by', v_employee.early_release_by,
        'early_release_recorded_at', v_employee.early_release_recorded_at
    );

    UPDATE public.resignation_requests
    SET previous_employee_state = v_previous_state
    WHERE id = p_request_id
      AND previous_employee_state IS NULL;

    -- Preserve the existing resignation approval behavior.
    -- Calculate expiry using the same UTC end-of-day convention
    -- as the existing Employee Exit API.
    v_temporary_login_expires_at :=
        (
            (v_planned_last_working_date + p_temporary_login_days + 1)::TIMESTAMP
            AT TIME ZONE 'UTC'
        ) - INTERVAL '1 second';

    UPDATE public.employees
    SET status = 'on_notice',
        resignation_date = v_resignation_date,
        notice_period_days = v_notice_period_days,
        planned_last_working_date = v_planned_last_working_date,
        notice_status = 'notice_period',
        exit_reason = v_request.reason,
        exit_document_url = v_request.document_url,
        exit_document_name = v_request.document_name,
        exit_date = NULL,
        temporary_login_days = p_temporary_login_days,
        temporary_login_expires_at = v_temporary_login_expires_at,
        early_release_date = NULL,
        early_release_reason = NULL,
        early_release_by = NULL,
        early_release_recorded_at = NULL
    WHERE id = v_request.employee_id;

    UPDATE public.resignation_requests
    SET status = 'approved',
        reviewed_by = p_reviewer_id,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
        'success', true,
        'decision', 'approved',
        'request_id', p_request_id,
        'notice_period_days', v_notice_period_days,
        'planned_last_working_date', v_planned_last_working_date,
        'temporary_login_days', p_temporary_login_days,
        'temporary_login_expires_at', v_temporary_login_expires_at
    );
END;
$$;


--
-- Name: review_resignation_revert_request(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.review_resignation_revert_request(p_revert_request_id uuid, p_reviewer_id uuid, p_decision text, p_rejection_reason text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    v_revert public.resignation_revert_requests%ROWTYPE;
    v_resignation public.resignation_requests%ROWTYPE;
    v_state jsonb;
    v_deadline date;
BEGIN
    IF p_decision NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Invalid reversal decision';
    END IF;

    SELECT *
    INTO v_revert
    FROM public.resignation_revert_requests
    WHERE id = p_revert_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reversal request not found';
    END IF;

    IF v_revert.status <> 'pending' THEN
        RAISE EXCEPTION 'This reversal request has already been reviewed';
    END IF;

    SELECT *
    INTO v_resignation
    FROM public.resignation_requests
    WHERE id = v_revert.resignation_request_id
    FOR UPDATE;

    IF NOT FOUND OR v_resignation.status <> 'approved' THEN
        RAISE EXCEPTION 'The original resignation is not approved';
    END IF;

    -- Rejection: preserve employee state and record the decision.
    IF p_decision = 'rejected' THEN
        IF NULLIF(TRIM(p_rejection_reason), '') IS NULL THEN
            RAISE EXCEPTION 'A rejection reason is required';
        END IF;

        UPDATE public.resignation_revert_requests
        SET status = 'rejected',
            rejection_reason = TRIM(p_rejection_reason),
            reviewed_by = p_reviewer_id,
            reviewed_at = NOW(),
            updated_at = NOW()
        WHERE id = p_revert_request_id;

        RETURN jsonb_build_object(
            'success', true,
            'decision', 'rejected',
            'request_id', p_revert_request_id
        );
    END IF;

    -- Validate the reversal deadline.
    v_deadline := v_resignation.planned_last_working_date;

    IF v_deadline IS NULL THEN
        SELECT planned_last_working_date
        INTO v_deadline
        FROM public.employees
        WHERE id = v_resignation.employee_id;
    END IF;

    IF v_deadline IS NULL OR CURRENT_DATE > v_deadline THEN
        RAISE EXCEPTION 'The reversal deadline has passed or is unavailable';
    END IF;

    v_state := v_resignation.previous_employee_state;

    IF v_state IS NULL THEN
        RAISE EXCEPTION
            'Cannot reverse this resignation automatically because its original employee state was not saved';
    END IF;

    -- Restore the previous employee state and clear resignation-only fields.
    UPDATE public.employees
    SET
        status = COALESCE(
            NULLIF(v_state ->> 'status', ''),
            'active'
        ),

        resignation_date = NULL,
        notice_period_days = NULL,
        planned_last_working_date = NULL,
        notice_status = NULL,

        temporary_login_days = NULL,
        temporary_login_expires_at = NULL,

        exit_reason = NULL,
        exit_document_url = NULL,
        exit_document_name = NULL,
        exit_date = NULL,
        early_release_date = NULL,
        early_release_reason = NULL,
        early_release_by = NULL,
        early_release_recorded_at = NULL,

        updated_at = NOW()
    WHERE id = v_resignation.employee_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee record not found';
    END IF;

    -- Keep the original resignation and reversal records for audit history.
    UPDATE public.resignation_requests
    SET status = 'reverted',
        updated_at = NOW()
    WHERE id = v_resignation.id;

    UPDATE public.resignation_revert_requests
    SET status = 'approved',
        reviewed_by = p_reviewer_id,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_revert_request_id;

    RETURN jsonb_build_object(
        'success', true,
        'decision', 'approved',
        'request_id', p_revert_request_id,
        'resignation_request_id', v_resignation.id
    );
END;
$$;


--
-- Name: rollback_candidate_onboarding_link_generation(uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rollback_candidate_onboarding_link_generation(p_candidate_id uuid, p_lock_id uuid, p_new_token_id uuid, p_previous_token_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.joining_onboarding_link_locks
        WHERE candidate_id = p_candidate_id
          AND lock_id = p_lock_id
    ) THEN
        RAISE EXCEPTION 'Generation lock not found or expired';
    END IF;

    UPDATE public.joining_onboarding_tokens
    SET revoked_at = NOW()
    WHERE id = p_new_token_id
      AND candidate_id = p_candidate_id
      AND used_at IS NULL
      AND revoked_at IS NULL;

    IF p_previous_token_id IS NOT NULL THEN
        UPDATE public.joining_onboarding_tokens
        SET revoked_at = NULL
        WHERE id = p_previous_token_id
          AND candidate_id = p_candidate_id
          AND used_at IS NULL;
    END IF;

    DELETE FROM public.joining_onboarding_link_locks
    WHERE candidate_id = p_candidate_id
      AND lock_id = p_lock_id;
END;
$$;


--
-- Name: submit_candidate_onboarding(uuid, uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_candidate_onboarding(p_candidate_id uuid, p_submission_id uuid, p_required_document_types text[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_candidate record;
  v_submission record;
  v_document_type text;
  v_document_status text;
begin
  -- This function is intended to be called by the server using
  -- the Supabase service-role client.
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'UNAUTHORIZED';
  end if;

  -- Lock the candidate to prevent concurrent submission/conversion.
  select *
    into v_candidate
    from public.joining_candidates
   where id = p_candidate_id
   for update;

  if not found then
    raise exception 'CANDIDATE_NOT_FOUND';
  end if;

  if v_candidate.status <> 'offer_accepted'
     or v_candidate.onboarding_status <> 'in_progress'
     or v_candidate.onboarding_submission_id <> p_submission_id
     or v_candidate.conversion_status in ('processing', 'completed')
     or v_candidate.employee_record_id is not null then
    raise exception 'CANDIDATE_NOT_ELIGIBLE';
  end if;

  -- Lock the exact current submission.
  select *
    into v_submission
    from public.joining_onboarding_submissions
   where id = p_submission_id
     and candidate_id = p_candidate_id
   for update;

  if not found then
    raise exception 'SUBMISSION_NOT_FOUND';
  end if;

  if v_submission.status <> 'draft' then
    raise exception 'SUBMISSION_NOT_EDITABLE';
  end if;

  -- Validate the latest uploaded version of every required document
  -- for this exact candidate and submission.
  foreach v_document_type in array
    coalesce(p_required_document_types, array[]::text[])
  loop
    select d.verification_status
      into v_document_status
      from public.joining_onboarding_documents d
     where d.candidate_id = p_candidate_id
       and d.submission_id = p_submission_id
       and d.document_type = v_document_type
     order by d.version desc
     limit 1;

    if not found then
      raise exception 'REQUIRED_DOCUMENT_MISSING:%', v_document_type;
    end if;

    if v_document_status in ('rejected', 'resubmission_required') then
      raise exception 'REQUIRED_DOCUMENT_INVALID:%', v_document_type;
    end if;
  end loop;

  -- Update both records in the same database transaction.
  update public.joining_onboarding_submissions
     set status = 'submitted',
         submitted_at = now(),
         updated_at = now()
   where id = p_submission_id
     and candidate_id = p_candidate_id
     and status = 'draft';

  update public.joining_candidates
     set onboarding_status = 'submitted',
         updated_at = now()
   where id = p_candidate_id
     and onboarding_submission_id = p_submission_id
     and onboarding_status = 'in_progress';

  insert into public.joining_onboarding_events (
    candidate_id,
    submission_id,
    actor_type,
    actor_user_id,
    event_type,
    event_details
  )
  values (
    p_candidate_id,
    p_submission_id,
    'candidate',
    null,
    'onboarding_submitted',
    jsonb_build_object(
      'required_document_types',
      to_jsonb(coalesce(p_required_document_types, array[]::text[])),
      'submitted_at',
      now()
    )
  );

  return jsonb_build_object(
    'success', true,
    'candidate_id', p_candidate_id,
    'submission_id', p_submission_id,
    'status', 'submitted'
  );
end;
$$;


--
-- Name: submit_candidate_onboarding(uuid, uuid, text[], uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_candidate_onboarding(p_candidate_id uuid, p_submission_id uuid, p_required_document_types text[], p_employment_record_ids uuid[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_candidate record;
  v_submission record;

  v_document_type text;
  v_employment_document_type text;
  v_employment_record_id uuid;

  v_current_doc record;
  v_prior_doc record;

  v_has_current boolean;
  v_has_prior boolean;
  v_resubmission_authorized boolean;

  v_correction_details jsonb;

  v_employment_history jsonb;
  v_employment_count integer;
  v_is_experienced boolean;

  v_latest_employer_record_id uuid;
  v_latest_employer_end_date date;
  v_payslip_count integer;

  v_employment_ids uuid[] :=
    coalesce(p_employment_record_ids, array[]::uuid[]);
BEGIN
  -- Only the server-side service-role client may execute this function.
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- 1. Lock candidate.
  SELECT *
    INTO v_candidate
    FROM public.joining_candidates
   WHERE id = p_candidate_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CANDIDATE_NOT_FOUND';
  END IF;

  IF NOT (
       v_candidate.status = 'offer_accepted'
       OR (
         v_candidate.status = 'joining_letter_sent'
         AND v_candidate.onboarding_verification_reopened_at IS NOT NULL
       )
     )
     OR v_candidate.onboarding_status NOT IN (
       'in_progress',
       'correction_required'
     )
     OR v_candidate.onboarding_submission_id <> p_submission_id
     OR v_candidate.conversion_status IN ('processing', 'completed')
     OR v_candidate.employee_record_id IS NOT NULL THEN
    RAISE EXCEPTION 'CANDIDATE_NOT_ELIGIBLE';
  END IF;

  -- 2. Lock the exact active submission.
  SELECT *
    INTO v_submission
    FROM public.joining_onboarding_submissions
   WHERE id = p_submission_id
     AND candidate_id = p_candidate_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUBMISSION_NOT_FOUND';
  END IF;

  IF v_submission.status <> 'draft' THEN
    RAISE EXCEPTION 'SUBMISSION_NOT_EDITABLE';
  END IF;

  -- 3. Read the correction instructions attached to this active submission.
  SELECT e.event_details
    INTO v_correction_details
    FROM public.joining_onboarding_events e
   WHERE e.candidate_id = p_candidate_id
     AND e.submission_id = p_submission_id
     AND e.event_type = 'onboarding_corrections_requested'
   ORDER BY e.created_at DESC
   LIMIT 1;

  v_correction_details :=
    coalesce(v_correction_details, '{}'::jsonb);

  -- 4. Determine whether candidate is experienced.
  v_is_experienced :=
    lower(trim(coalesce(v_candidate.experience_level, ''))) = 'experienced'
    OR coalesce(v_candidate.total_experience_years, 0) > 0
    OR coalesce(v_candidate.total_experience_months, 0) > 0;

  -- 5. Read employer history from this submission.
  v_employment_history :=
    v_submission.submission_data
      #> '{previousEmploymentDetails,employmentHistory}';

  IF v_is_experienced THEN

    IF v_employment_history IS NULL
       OR jsonb_typeof(v_employment_history) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'EMPLOYMENT_RECORDS_REQUIRED';
    END IF;

    IF jsonb_array_length(v_employment_history) = 0 THEN
      RAISE EXCEPTION 'EMPLOYMENT_RECORDS_REQUIRED';
    END IF;

    v_employment_count := jsonb_array_length(v_employment_history);

    IF v_employment_count > 20 THEN
      RAISE EXCEPTION 'EMPLOYMENT_RECORD_INVALID:TOO_MANY';
    END IF;

    IF cardinality(v_employment_ids) <> v_employment_count THEN
      RAISE EXCEPTION 'EMPLOYMENT_RECORD_INVALID:COUNT_MISMATCH';
    END IF;

    IF EXISTS (
      SELECT 1
        FROM unnest(v_employment_ids) AS supplied(id)
       WHERE supplied.id IS NULL
    ) THEN
      RAISE EXCEPTION 'EMPLOYMENT_RECORD_INVALID:NULL_ID';
    END IF;

    IF (
      SELECT count(DISTINCT supplied.id)
        FROM unnest(v_employment_ids) AS supplied(id)
    ) <> cardinality(v_employment_ids) THEN
      RAISE EXCEPTION 'EMPLOYMENT_RECORD_INVALID:DUPLICATE_ID';
    END IF;

    FOREACH v_employment_record_id IN ARRAY v_employment_ids
    LOOP
      IF NOT EXISTS (
        SELECT 1
          FROM jsonb_array_elements(v_employment_history)
               AS employer(item)
         WHERE employer.item ->> 'id' = v_employment_record_id::text
      ) THEN
        RAISE EXCEPTION 'EMPLOYMENT_RECORD_INVALID:UNKNOWN_ID';
      END IF;
    END LOOP;

  ELSE

    IF cardinality(v_employment_ids) <> 0 THEN
      RAISE EXCEPTION 'EMPLOYMENT_RECORD_INVALID:UNEXPECTED_ID';
    END IF;

  END IF;

  -- 6. Validate every general required document.
  FOREACH v_document_type IN ARRAY
    coalesce(p_required_document_types, array[]::text[])
  LOOP

    -- Find the latest document uploaded directly to the active submission.
    SELECT d.id, d.verification_status
      INTO v_current_doc
      FROM public.joining_onboarding_documents d
     WHERE d.candidate_id = p_candidate_id
       AND d.submission_id = p_submission_id
       AND d.document_type = v_document_type
       AND d.employment_record_id IS NULL
     ORDER BY d.version DESC, d.uploaded_at DESC
     LIMIT 1;

    v_has_current := FOUND;

    -- Find the nearest previous document in the submission ancestry.
    WITH RECURSIVE submission_chain AS (
      SELECT
        s.id,
        s.supersedes_submission_id,
        0 AS depth,
        ARRAY[s.id] AS visited
      FROM public.joining_onboarding_submissions s
      WHERE s.id = p_submission_id
        AND s.candidate_id = p_candidate_id

      UNION ALL

      SELECT
        parent.id,
        parent.supersedes_submission_id,
        child.depth + 1,
        child.visited || parent.id
      FROM submission_chain child
      JOIN public.joining_onboarding_submissions parent
        ON parent.id = child.supersedes_submission_id
       AND parent.candidate_id = p_candidate_id
      WHERE child.depth < 20
        AND NOT parent.id = ANY(child.visited)
    )
    SELECT
      d.id,
      d.verification_status,
      d.document_type,
      d.employment_record_id
      INTO v_prior_doc
      FROM submission_chain chain
      JOIN public.joining_onboarding_documents d
        ON d.submission_id = chain.id
     WHERE chain.depth > 0
       AND d.candidate_id = p_candidate_id
       AND d.document_type = v_document_type
       AND d.employment_record_id IS NULL
     ORDER BY chain.depth ASC, d.version DESC, d.uploaded_at DESC
     LIMIT 1;

    v_has_prior := FOUND;

    -- If a previous document exists, only an exact HR correction item
    -- authorizes replacing that specific document.
    v_resubmission_authorized := false;

    IF v_has_prior THEN
      SELECT EXISTS (
        SELECT 1
          FROM jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(
                v_correction_details -> 'correction_items'
              ) = 'array'
              THEN v_correction_details -> 'correction_items'
              ELSE '[]'::jsonb
            END
          ) item
         WHERE item ->> 'type' = 'document'
           AND item ->> 'document_id' = v_prior_doc.id::text
           AND item ->> 'document_type' = v_document_type
           AND item ->> 'employment_record_id' IS NULL
      )
      INTO v_resubmission_authorized;
    END IF;

    IF v_has_prior AND v_resubmission_authorized THEN

      -- HR explicitly requested replacement. A new active-submission
      -- upload is mandatory.
      IF NOT v_has_current THEN
        RAISE EXCEPTION 'REQUIRED_DOCUMENT_MISSING:%', v_document_type;
      END IF;

      IF v_current_doc.verification_status IN (
        'rejected',
        'resubmission_required'
      ) THEN
        RAISE EXCEPTION 'REQUIRED_DOCUMENT_INVALID:%', v_document_type;
      END IF;

    ELSIF v_has_prior THEN

      -- No explicit replacement request: reuse the nearest previous
      -- document and ignore any unauthorized active-submission upload.
      IF v_prior_doc.verification_status IN (
        'rejected',
        'resubmission_required'
      ) THEN
        RAISE EXCEPTION 'REQUIRED_DOCUMENT_INVALID:%', v_document_type;
      END IF;

    ELSE

      -- First upload for this document key: it must exist in the
      -- active submission.
      IF NOT v_has_current THEN
        RAISE EXCEPTION 'REQUIRED_DOCUMENT_MISSING:%', v_document_type;
      END IF;

      IF v_current_doc.verification_status IN (
        'rejected',
        'resubmission_required'
      ) THEN
        RAISE EXCEPTION 'REQUIRED_DOCUMENT_INVALID:%', v_document_type;
      END IF;

    END IF;

  END LOOP;


  -- 7. Validate all mandatory documents for every employer
  -- and at least three payslips for the most recent employer.
  IF v_is_experienced THEN

    DECLARE
      v_employer_item jsonb;
      v_end_date_text text;
      v_end_date date;
      v_latest_end_date date;
      v_latest_employer_id uuid;
      v_latest_date_count integer := 0;
      v_verified_payslip_count integer := 0;
      v_payslip_index integer;
    BEGIN

      -- Determine the most recent employer using employment end date.
      -- Missing, invalid or tied dates must be corrected before submission.
      FOR v_employer_item IN
        SELECT employer.item
        FROM jsonb_array_elements(v_employment_history) AS employer(item)
      LOOP

        v_end_date_text := coalesce(
          nullif(trim(v_employer_item ->> 'employmentEndDate'), ''),
          nullif(trim(v_employer_item ->> 'employment_end_date'), '')
        );

        IF v_end_date_text IS NULL
           OR v_end_date_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
          RAISE EXCEPTION
            'EMPLOYMENT_END_DATE_REQUIRED_FOR_PAYSLIP_VALIDATION';
        END IF;

        BEGIN
          v_end_date := v_end_date_text::date;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION
            'EMPLOYMENT_END_DATE_INVALID_FOR_PAYSLIP_VALIDATION';
        END;

        IF v_latest_end_date IS NULL
           OR v_end_date > v_latest_end_date THEN
          v_latest_end_date := v_end_date;
          v_latest_employer_id := (v_employer_item ->> 'id')::uuid;
          v_latest_date_count := 1;
        ELSIF v_end_date = v_latest_end_date THEN
          v_latest_date_count := v_latest_date_count + 1;
        END IF;

      END LOOP;

      IF v_latest_employer_id IS NULL THEN
        RAISE EXCEPTION 'MOST_RECENT_EMPLOYER_COULD_NOT_BE_DETERMINED';
      END IF;

      IF v_latest_date_count > 1 THEN
        RAISE EXCEPTION 'MOST_RECENT_EMPLOYER_DATE_AMBIGUOUS';
      END IF;

      -- Four mandatory documents for every previous employer.
      FOREACH v_employment_record_id IN ARRAY v_employment_ids
      LOOP

        FOREACH v_employment_document_type IN ARRAY
          ARRAY[
            'experience_document',
            'relieving_letter',
            'previous_joining_letter',
            'salary_hike_letter'
          ]::text[]
        LOOP

          SELECT d.id, d.verification_status
            INTO v_current_doc
            FROM public.joining_onboarding_documents d
           WHERE d.candidate_id = p_candidate_id
             AND d.submission_id = p_submission_id
             AND d.employment_record_id = v_employment_record_id
             AND d.document_type = v_employment_document_type
           ORDER BY d.version DESC, d.uploaded_at DESC
           LIMIT 1;

          v_has_current := FOUND;

          WITH RECURSIVE submission_chain AS (
            SELECT
              s.id,
              s.supersedes_submission_id,
              0 AS depth,
              ARRAY[s.id] AS visited
            FROM public.joining_onboarding_submissions s
            WHERE s.id = p_submission_id
              AND s.candidate_id = p_candidate_id

            UNION ALL

            SELECT
              parent.id,
              parent.supersedes_submission_id,
              child.depth + 1,
              child.visited || parent.id
            FROM submission_chain child
            JOIN public.joining_onboarding_submissions parent
              ON parent.id = child.supersedes_submission_id
             AND parent.candidate_id = p_candidate_id
            WHERE child.depth < 20
              AND NOT parent.id = ANY(child.visited)
          )
          SELECT
            d.id,
            d.verification_status,
            d.document_type,
            d.employment_record_id
            INTO v_prior_doc
            FROM submission_chain chain
            JOIN public.joining_onboarding_documents d
              ON d.submission_id = chain.id
           WHERE chain.depth > 0
             AND d.candidate_id = p_candidate_id
             AND d.employment_record_id = v_employment_record_id
             AND d.document_type = v_employment_document_type
           ORDER BY chain.depth ASC, d.version DESC, d.uploaded_at DESC
           LIMIT 1;

          v_has_prior := FOUND;
          v_resubmission_authorized := false;

          IF v_has_prior THEN
            SELECT EXISTS (
              SELECT 1
              FROM jsonb_array_elements(
                CASE
                  WHEN jsonb_typeof(
                    v_correction_details -> 'correction_items'
                  ) = 'array'
                  THEN v_correction_details -> 'correction_items'
                  ELSE '[]'::jsonb
                END
              ) item
              WHERE item ->> 'type' = 'document'
                AND item ->> 'document_id' = v_prior_doc.id::text
                AND item ->> 'document_type' =
                    v_employment_document_type
                AND item ->> 'employment_record_id' =
                    v_employment_record_id::text
            )
            INTO v_resubmission_authorized;
          END IF;

          IF v_has_prior AND v_resubmission_authorized THEN

            IF NOT v_has_current THEN
              RAISE EXCEPTION
                'EMPLOYMENT_DOCUMENT_MISSING:%',
                v_employment_document_type;
            END IF;

            IF v_current_doc.verification_status IN (
              'rejected',
              'resubmission_required'
            ) THEN
              RAISE EXCEPTION
                'EMPLOYMENT_DOCUMENT_INVALID:%',
                v_employment_document_type;
            END IF;

          ELSIF v_has_prior THEN

            IF v_prior_doc.verification_status IN (
              'rejected',
              'resubmission_required'
            ) THEN
              RAISE EXCEPTION
                'EMPLOYMENT_DOCUMENT_INVALID:%',
                v_employment_document_type;
            END IF;

          ELSE

            IF NOT v_has_current THEN
              RAISE EXCEPTION
                'EMPLOYMENT_DOCUMENT_MISSING:%',
                v_employment_document_type;
            END IF;

            IF v_current_doc.verification_status IN (
              'rejected',
              'resubmission_required'
            ) THEN
              RAISE EXCEPTION
                'EMPLOYMENT_DOCUMENT_INVALID:%',
                v_employment_document_type;
            END IF;

          END IF;

        END LOOP;

      END LOOP;

      -- Require at least three valid payslip document slots
      -- for the most recent employer only.
      v_verified_payslip_count := 0;

      FOR v_payslip_index IN 1..6
      LOOP

        v_employment_document_type :=
          'payslip_' || v_payslip_index::text;

        SELECT d.id, d.verification_status
          INTO v_current_doc
          FROM public.joining_onboarding_documents d
         WHERE d.candidate_id = p_candidate_id
           AND d.submission_id = p_submission_id
           AND d.employment_record_id = v_latest_employer_id
           AND d.document_type = v_employment_document_type
         ORDER BY d.version DESC, d.uploaded_at DESC
         LIMIT 1;

        v_has_current := FOUND;

        WITH RECURSIVE submission_chain AS (
          SELECT
            s.id,
            s.supersedes_submission_id,
            0 AS depth,
            ARRAY[s.id] AS visited
          FROM public.joining_onboarding_submissions s
          WHERE s.id = p_submission_id
            AND s.candidate_id = p_candidate_id

          UNION ALL

          SELECT
            parent.id,
            parent.supersedes_submission_id,
            child.depth + 1,
            child.visited || parent.id
          FROM submission_chain child
          JOIN public.joining_onboarding_submissions parent
            ON parent.id = child.supersedes_submission_id
           AND parent.candidate_id = p_candidate_id
          WHERE child.depth < 20
            AND NOT parent.id = ANY(child.visited)
        )
        SELECT
          d.id,
          d.verification_status,
          d.document_type,
          d.employment_record_id
          INTO v_prior_doc
          FROM submission_chain chain
          JOIN public.joining_onboarding_documents d
            ON d.submission_id = chain.id
         WHERE chain.depth > 0
           AND d.candidate_id = p_candidate_id
           AND d.employment_record_id = v_latest_employer_id
           AND d.document_type = v_employment_document_type
         ORDER BY chain.depth ASC, d.version DESC, d.uploaded_at DESC
         LIMIT 1;

        v_has_prior := FOUND;
        v_resubmission_authorized := false;

        IF v_has_prior THEN
          SELECT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(
              CASE
                WHEN jsonb_typeof(
                  v_correction_details -> 'correction_items'
                ) = 'array'
                THEN v_correction_details -> 'correction_items'
                ELSE '[]'::jsonb
              END
            ) item
            WHERE item ->> 'type' = 'document'
              AND item ->> 'document_id' = v_prior_doc.id::text
              AND item ->> 'document_type' =
                  v_employment_document_type
              AND item ->> 'employment_record_id' =
                  v_latest_employer_id::text
          )
          INTO v_resubmission_authorized;
        END IF;

        IF v_has_prior AND v_resubmission_authorized THEN

          IF NOT v_has_current THEN
            RAISE EXCEPTION
              'EMPLOYMENT_DOCUMENT_MISSING:%',
              v_employment_document_type;
          END IF;

          IF v_current_doc.verification_status IN (
            'rejected',
            'resubmission_required'
          ) THEN
            RAISE EXCEPTION
              'EMPLOYMENT_DOCUMENT_INVALID:%',
              v_employment_document_type;
          END IF;

          v_verified_payslip_count :=
            v_verified_payslip_count + 1;

        ELSIF v_has_prior THEN

          IF v_prior_doc.verification_status IN (
            'rejected',
            'resubmission_required'
          ) THEN
            RAISE EXCEPTION
              'EMPLOYMENT_DOCUMENT_INVALID:%',
              v_employment_document_type;
          END IF;

          v_verified_payslip_count :=
            v_verified_payslip_count + 1;

        ELSIF v_has_current THEN

          IF v_current_doc.verification_status IN (
            'rejected',
            'resubmission_required'
          ) THEN
            RAISE EXCEPTION
              'EMPLOYMENT_DOCUMENT_INVALID:%',
              v_employment_document_type;
          END IF;

          v_verified_payslip_count :=
            v_verified_payslip_count + 1;

        END IF;

      END LOOP;

      IF v_verified_payslip_count < 3 THEN
        RAISE EXCEPTION
          'LATEST_EMPLOYER_REQUIRES_AT_LEAST_3_PAYSLIPS';
      END IF;

    END;

  END IF;

  -- 8. Update submission and candidate in the same transaction.
  UPDATE public.joining_onboarding_submissions
     SET status = 'submitted',
         submitted_at = now(),
         updated_at = now()
   WHERE id = p_submission_id
     AND candidate_id = p_candidate_id
     AND status = 'draft';

  UPDATE public.joining_candidates
     SET onboarding_status = 'submitted',
         updated_at = now()
   WHERE id = p_candidate_id
     AND onboarding_submission_id = p_submission_id
     AND onboarding_status IN (
       'in_progress',
       'correction_required'
     );

  -- 9. Preserve the audit event.
  INSERT INTO public.joining_onboarding_events (
    candidate_id,
    submission_id,
    actor_type,
    actor_user_id,
    event_type,
    event_details
  )
  VALUES (
    p_candidate_id,
    p_submission_id,
    'candidate',
    null,
    'onboarding_submitted',
    jsonb_build_object(
      'required_document_types',
      to_jsonb(coalesce(p_required_document_types, array[]::text[])),
      'employment_record_ids',
      to_jsonb(v_employment_ids),
      'submitted_at',
      now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'candidate_id', p_candidate_id,
    'submission_id', p_submission_id,
    'status', 'submitted',
    'employment_records_count', cardinality(v_employment_ids)
  );

END;
$_$;


--
-- Name: submit_candidate_onboarding(uuid, uuid, uuid, text[], uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_candidate_onboarding(p_candidate_id uuid, p_submission_id uuid, p_token_id uuid, p_required_document_types text[], p_employment_record_ids uuid[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_locked_candidate_id uuid;
  v_locked_token_id uuid;
  v_result jsonb;
BEGIN
  -- Only the server-side service-role client may execute this function.
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- Lock candidate first to maintain consistent lock ordering.
  SELECT id
    INTO v_locked_candidate_id
    FROM public.joining_candidates
   WHERE id = p_candidate_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CANDIDATE_NOT_FOUND';
  END IF;

  -- Lock and verify the exact token for this candidate and submission.
  SELECT id
    INTO v_locked_token_id
    FROM public.joining_onboarding_tokens
   WHERE id = p_token_id
     AND candidate_id = p_candidate_id
     AND submission_id = p_submission_id
     AND used_at IS NULL
     AND revoked_at IS NULL
     AND expires_at > now()
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ONBOARDING_TOKEN_INVALID_OR_ALREADY_USED';
  END IF;

  -- Run the existing complete submission validation and updates.
  -- Any failure rolls back this entire transaction.
  v_result := public.submit_candidate_onboarding(
    p_candidate_id,
    p_submission_id,
    p_required_document_types,
    p_employment_record_ids
  );

  -- Consume only the exact token after successful submission.
  UPDATE public.joining_onboarding_tokens
     SET used_at = now()
   WHERE id = v_locked_token_id
     AND candidate_id = p_candidate_id
     AND submission_id = p_submission_id
     AND used_at IS NULL
     AND revoked_at IS NULL
     AND expires_at > now()
  RETURNING id INTO v_locked_token_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ONBOARDING_TOKEN_CONSUMPTION_FAILED';
  END IF;

  RETURN v_result;
END;
$$;


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
    session_check_in_time timestamp with time zone,
    work_mode text DEFAULT 'WFO'::text NOT NULL,
    absence_marked_by uuid,
    absence_marked_at timestamp with time zone,
    absence_reason text,
    hr_decision_by uuid,
    hr_decision_at timestamp with time zone,
    hr_decision_reason text,
    CONSTRAINT attendance_logs_status_check CHECK ((status = ANY (ARRAY['present'::text, 'half_day'::text, 'absent'::text, 'on_leave'::text, 'holiday'::text, 'weekend'::text]))),
    CONSTRAINT attendance_logs_work_mode_check CHECK (((work_mode IS NULL) OR (work_mode = ANY (ARRAY['WFO'::text, 'WFH'::text]))))
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
-- Name: attendance_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_settings (
    count_approved_leaves_toward_weekly_minimum boolean DEFAULT false NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    employee_id uuid,
    setting_key text NOT NULL,
    CONSTRAINT attendance_settings_key_check CHECK ((((setting_key = 'global'::text) AND (employee_id IS NULL)) OR ((setting_key = ('employee:'::text || (employee_id)::text)) AND (employee_id IS NOT NULL))))
);


--
-- Name: company_event_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_event_departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    department_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: company_event_employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_event_employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: company_event_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_event_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    image_url text NOT NULL,
    cloudinary_public_id text NOT NULL,
    alt_text character varying(250),
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: company_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    event_type text DEFAULT 'event'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    audience_scope text DEFAULT 'company'::text NOT NULL,
    event_date timestamp with time zone,
    end_date timestamp with time zone,
    location text,
    expires_at timestamp with time zone,
    created_by uuid,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT company_events_audience_check CHECK (((event_type = 'emergency_announcement'::text) OR (audience_scope = 'company'::text))),
    CONSTRAINT company_events_audience_scope_check CHECK ((audience_scope = ANY (ARRAY['company'::text, 'departments'::text, 'individuals'::text]))),
    CONSTRAINT company_events_date_check CHECK (((end_date IS NULL) OR (event_date IS NULL) OR (end_date >= event_date))),
    CONSTRAINT company_events_event_type_check CHECK ((event_type = ANY (ARRAY['event'::text, 'emergency_announcement'::text]))),
    CONSTRAINT company_events_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
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
    source_joining_document_id uuid,
    source_onboarding_document_id uuid,
    source_onboarding_submission_id uuid,
    source_employment_record_id uuid,
    source_onboarding_storage_path text,
    original_file_name text,
    source_document_version integer,
    source_mime_type text,
    source_file_size_bytes bigint,
    source_sha256_hash text,
    source_uploaded_at timestamp with time zone,
    CONSTRAINT employee_documents_verification_status_check CHECK ((verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'approved'::text, 'rejected'::text, 'superseded'::text, 'resubmission_required'::text])))
);


--
-- Name: employee_education; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_education (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    source_submission_id uuid NOT NULL,
    source_qualification_key text NOT NULL,
    qualification_type text,
    qualification_name text,
    course text,
    specialization text,
    institution_name text,
    board text,
    university text,
    stream text,
    year_of_passing text,
    result_type text,
    result_value text,
    result_total text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT employee_education_result_type_check CHECK (((result_type IS NULL) OR (result_type = ANY (ARRAY['Percentage'::text, 'CGPA'::text, 'Grade'::text]))))
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
-- Name: employee_previous_employment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_previous_employment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    source_submission_id uuid NOT NULL,
    source_employment_record_id uuid NOT NULL,
    company_name text NOT NULL,
    designation text NOT NULL,
    employment_start_date date,
    employment_end_date date,
    reference_person_name text,
    reference_person_designation text,
    reference_contact_number text,
    reference_official_email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT employee_previous_employment_dates_check CHECK (((employment_start_date IS NULL) OR (employment_end_date IS NULL) OR (employment_end_date >= employment_start_date)))
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
    resignation_date date,
    notice_period_days integer,
    planned_last_working_date date,
    notice_status text,
    early_release_date date,
    early_release_reason text,
    early_release_by uuid,
    early_release_recorded_at timestamp with time zone,
    experience_level text,
    total_experience_years numeric(4,1),
    total_experience_months integer,
    team_id uuid,
    shift_type text DEFAULT 'general'::text NOT NULL,
    retained_calendar_id uuid,
    retained_shift_start_time time without time zone,
    retained_shift_end_time time without time zone,
    retained_grace_period_minutes integer,
    retained_half_day_cutoff_minutes integer,
    retained_project_id uuid,
    is_reporting_manager boolean DEFAULT false,
    reporting_manager_id uuid,
    driving_license_number text,
    professional_certification_name text,
    technical_skills jsonb DEFAULT '[]'::jsonb NOT NULL,
    professional_certification_organization text,
    professional_certification_credential_id text,
    professional_certification_issue_date date,
    professional_certification_expiry_date date,
    educational_details jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT employees_employment_type_check CHECK ((employment_type = ANY (ARRAY['full-time'::text, 'part-time'::text, 'contract'::text, 'intern'::text]))),
    CONSTRAINT employees_experience_level_check CHECK (((experience_level IS NULL) OR (lower(experience_level) = ANY (ARRAY['fresher'::text, 'experienced'::text])))),
    CONSTRAINT employees_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text]))),
    CONSTRAINT employees_marital_status_check CHECK ((marital_status = ANY (ARRAY['single'::text, 'married'::text, 'divorced'::text, 'widowed'::text]))),
    CONSTRAINT employees_reporting_manager_not_self CHECK (((reporting_manager_id IS NULL) OR (reporting_manager_id <> id))),
    CONSTRAINT employees_shift_type_check CHECK ((shift_type = ANY (ARRAY['general'::text, 'night'::text]))),
    CONSTRAINT employees_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'terminated'::text, 'resigned'::text, 'laid_off'::text, 'on_notice'::text]))),
    CONSTRAINT employees_total_experience_years_check CHECK (((total_experience_years IS NULL) OR (total_experience_years >= (0)::numeric))),
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
    created_at timestamp with time zone DEFAULT now(),
    shift_type text NOT NULL,
    calendar_year integer NOT NULL,
    document_public_id text,
    document_file_name text,
    document_uploaded_by uuid,
    document_uploaded_at timestamp with time zone,
    extracted_holidays jsonb,
    document_status text DEFAULT 'not_uploaded'::text NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    approval_remarks text,
    imported_at timestamp with time zone,
    imported_by uuid,
    CONSTRAINT holiday_calendars_document_status_check CHECK ((document_status = ANY (ARRAY['not_uploaded'::text, 'uploaded'::text, 'extracted'::text, 'under_review'::text, 'approved'::text, 'rejected'::text, 'imported'::text]))),
    CONSTRAINT holiday_calendars_shift_type_check CHECK ((shift_type = ANY (ARRAY['general'::text, 'night'::text])))
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
    is_working_day boolean DEFAULT false NOT NULL,
    holiday_type text DEFAULT 'regular'::text NOT NULL,
    scope text DEFAULT 'calendar'::text NOT NULL,
    project_id uuid,
    reason text,
    status text DEFAULT 'active'::text NOT NULL,
    created_by uuid,
    cancelled_by uuid,
    cancelled_at timestamp with time zone,
    CONSTRAINT holidays_emergency_scope_check CHECK ((((holiday_type = 'regular'::text) AND (scope = 'calendar'::text) AND (project_id IS NULL)) OR ((holiday_type = 'emergency'::text) AND (scope = 'company'::text) AND (project_id IS NULL)) OR ((holiday_type = 'emergency'::text) AND (scope = 'project'::text) AND (project_id IS NOT NULL)))),
    CONSTRAINT holidays_scope_check CHECK ((scope = ANY (ARRAY['calendar'::text, 'company'::text, 'project'::text]))),
    CONSTRAINT holidays_status_check CHECK ((status = ANY (ARRAY['active'::text, 'cancelled'::text]))),
    CONSTRAINT holidays_type_check CHECK ((holiday_type = ANY (ARRAY['regular'::text, 'emergency'::text])))
);


--
-- Name: joining_action_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.joining_action_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid NOT NULL,
    token_hash text NOT NULL,
    action text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    document_id uuid,
    activated_at timestamp with time zone,
    CONSTRAINT joining_action_tokens_action_check CHECK ((action = ANY (ARRAY['accept_offer'::text, 'decline_offer'::text]))),
    CONSTRAINT joining_action_tokens_activation_check CHECK (((activated_at IS NULL) OR (document_id IS NOT NULL)))
);


--
-- Name: COLUMN joining_action_tokens.document_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.joining_action_tokens.document_id IS 'Exact offer document to which this accept or decline token belongs.';


--
-- Name: COLUMN joining_action_tokens.activated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.joining_action_tokens.activated_at IS 'Set only after the corresponding offer email has been accepted by the email provider and send status has been recorded.';


--
-- Name: joining_candidates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.joining_candidates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    personal_email text NOT NULL,
    mobile_number text NOT NULL,
    designation text NOT NULL,
    joining_date date,
    annual_ctc numeric(14,2) NOT NULL,
    status text DEFAULT 'selected'::text NOT NULL,
    created_by uuid,
    offer_sent_at timestamp with time zone,
    offer_decision_at timestamp with time zone,
    joining_letter_sent_at timestamp with time zone,
    joined_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    employee_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    gender text,
    probation_period_months integer,
    department text,
    employment_type text,
    work_location text,
    joining_letter_send_status text DEFAULT 'not_started'::text NOT NULL,
    joining_letter_send_started_at timestamp with time zone,
    joining_letter_email_provider_id text,
    employee_record_id uuid,
    conversion_status text DEFAULT 'not_started'::text NOT NULL,
    experience_level text,
    total_experience_years numeric(4,1),
    total_experience_months integer DEFAULT 0,
    onboarding_status text DEFAULT 'not_started'::text NOT NULL,
    onboarding_submission_id uuid,
    onboarding_draft_created_at timestamp with time zone,
    onboarding_draft_created_by uuid,
    onboarding_link_sent_at timestamp with time zone,
    onboarding_verified_at timestamp with time zone,
    onboarding_verified_by uuid,
    pf_eligible boolean,
    esi_eligible boolean,
    pt_eligible boolean,
    tds_eligible boolean,
    accepted_offer_document_id uuid,
    add_employee_moved_at timestamp with time zone,
    add_employee_moved_by uuid,
    credentials_email_status text DEFAULT 'not_sent'::text NOT NULL,
    credentials_email_sent_at timestamp with time zone,
    credentials_email_error text,
    onboarding_verification_reopened_at timestamp with time zone,
    onboarding_verification_reopened_by uuid,
    CONSTRAINT joining_candidates_annual_ctc_check CHECK ((annual_ctc >= (0)::numeric)),
    CONSTRAINT joining_candidates_conversion_status_check CHECK ((conversion_status = ANY (ARRAY['not_started'::text, 'processing'::text, 'completed'::text, 'failed'::text]))),
    CONSTRAINT joining_candidates_employment_type_check CHECK (((employment_type IS NULL) OR (employment_type = ANY (ARRAY['full_time'::text, 'contract'::text, 'intern'::text])))),
    CONSTRAINT joining_candidates_experience_level_check CHECK (((experience_level IS NULL) OR (lower(experience_level) = ANY (ARRAY['fresher'::text, 'experienced'::text])))),
    CONSTRAINT joining_candidates_joining_letter_send_status_check CHECK ((joining_letter_send_status = ANY (ARRAY['not_started'::text, 'sending'::text, 'sent'::text, 'failed'::text]))),
    CONSTRAINT joining_candidates_onboarding_status_check CHECK ((onboarding_status = ANY (ARRAY['not_started'::text, 'link_sent'::text, 'in_progress'::text, 'submitted'::text, 'correction_required'::text, 'verified'::text]))),
    CONSTRAINT joining_candidates_probation_period_months_check CHECK (((probation_period_months IS NULL) OR (probation_period_months = ANY (ARRAY[0, 3, 6, 12])))),
    CONSTRAINT joining_candidates_status_check CHECK ((status = ANY (ARRAY['selected'::text, 'offer_sent'::text, 'offer_accepted'::text, 'offer_declined'::text, 'joining_letter_sent'::text, 'joined'::text, 'cancelled'::text, 'expired'::text]))),
    CONSTRAINT joining_candidates_total_experience_check CHECK (((total_experience_years IS NULL) OR (total_experience_years >= (0)::numeric)))
);


--
-- Name: COLUMN joining_candidates.pf_eligible; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.joining_candidates.pf_eligible IS 'HR-confirmed PF applicability for the candidate';


--
-- Name: COLUMN joining_candidates.esi_eligible; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.joining_candidates.esi_eligible IS 'HR-confirmed ESI applicability for the candidate';


--
-- Name: COLUMN joining_candidates.pt_eligible; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.joining_candidates.pt_eligible IS 'HR-confirmed Professional Tax applicability for the candidate';


--
-- Name: COLUMN joining_candidates.tds_eligible; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.joining_candidates.tds_eligible IS 'HR-confirmed TDS applicability for the candidate';


--
-- Name: COLUMN joining_candidates.accepted_offer_document_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.joining_candidates.accepted_offer_document_id IS 'Exact offer document accepted by the candidate. Its offer_snapshot is the source of truth for final employee conversion.';


--
-- Name: joining_date_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.joining_date_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid NOT NULL,
    old_joining_date date NOT NULL,
    new_joining_date date NOT NULL,
    change_reason text NOT NULL,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT joining_date_history_check CHECK ((old_joining_date <> new_joining_date))
);


--
-- Name: joining_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.joining_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid NOT NULL,
    document_type text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    storage_path text NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    email_provider_id text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    file_name text,
    mime_type text,
    offer_snapshot jsonb,
    CONSTRAINT joining_documents_document_type_check CHECK ((document_type = ANY (ARRAY['offer_letter'::text, 'joining_letter'::text, 'resume'::text, 'experience_document'::text]))),
    CONSTRAINT joining_documents_offer_snapshot_object_check CHECK (((offer_snapshot IS NULL) OR (jsonb_typeof(offer_snapshot) = 'object'::text))),
    CONSTRAINT joining_documents_version_check CHECK ((version > 0))
);


--
-- Name: COLUMN joining_documents.offer_snapshot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.joining_documents.offer_snapshot IS 'Immutable salary structure and statutory eligibility snapshot used to generate this offer version.';


--
-- Name: joining_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.joining_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid NOT NULL,
    reminder_type text NOT NULL,
    scheduled_for date NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    sent_at timestamp with time zone,
    email_provider_id text,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT joining_notifications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: joining_onboarding_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.joining_onboarding_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid NOT NULL,
    submission_id uuid NOT NULL,
    document_type text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    original_file_name text NOT NULL,
    storage_path text NOT NULL,
    mime_type text NOT NULL,
    file_size_bytes bigint NOT NULL,
    sha256_hash text,
    verification_status text DEFAULT 'pending'::text NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    review_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    employment_record_id uuid,
    correction_instructions text,
    resubmission_requested_at timestamp with time zone,
    resubmission_requested_by uuid,
    resubmission_instructions text,
    CONSTRAINT joining_onboarding_documents_document_type_check CHECK ((length(TRIM(BOTH FROM document_type)) > 0)),
    CONSTRAINT joining_onboarding_documents_file_size_bytes_check CHECK ((file_size_bytes > 0)),
    CONSTRAINT joining_onboarding_documents_verification_status_check CHECK ((verification_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'resubmission_required'::text]))),
    CONSTRAINT joining_onboarding_documents_version_check CHECK ((version > 0))
);


--
-- Name: joining_onboarding_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.joining_onboarding_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid NOT NULL,
    submission_id uuid,
    actor_type text NOT NULL,
    actor_user_id uuid,
    event_type text NOT NULL,
    event_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT joining_onboarding_events_actor_type_check CHECK ((actor_type = ANY (ARRAY['candidate'::text, 'hr'::text, 'ceo'::text, 'system'::text]))),
    CONSTRAINT joining_onboarding_events_event_details_check CHECK ((jsonb_typeof(event_details) = 'object'::text))
);


--
-- Name: joining_onboarding_link_locks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.joining_onboarding_link_locks (
    candidate_id uuid NOT NULL,
    lock_id uuid NOT NULL,
    locked_until timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: joining_onboarding_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.joining_onboarding_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    submission_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    supersedes_submission_id uuid,
    submitted_at timestamp with time zone,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    review_notes text,
    verified_at timestamp with time zone,
    verified_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    employment_verification_status text DEFAULT 'pending'::text NOT NULL,
    employment_verified_at timestamp with time zone,
    employment_verified_by uuid,
    employment_review_notes text,
    personal_verification_status text DEFAULT 'pending'::text NOT NULL,
    personal_verified_at timestamp with time zone,
    personal_verified_by uuid,
    personal_review_notes text,
    address_verification_status text DEFAULT 'pending'::text NOT NULL,
    address_verified_at timestamp with time zone,
    address_verified_by uuid,
    address_review_notes text,
    bank_verification_status text DEFAULT 'pending'::text NOT NULL,
    bank_verified_at timestamp with time zone,
    bank_verified_by uuid,
    bank_review_notes text,
    identity_verification_status text DEFAULT 'pending'::text NOT NULL,
    identity_verified_at timestamp with time zone,
    identity_verified_by uuid,
    identity_review_notes text,
    education_verification_status text DEFAULT 'pending'::text NOT NULL,
    education_verified_at timestamp with time zone,
    education_verified_by uuid,
    education_review_notes text,
    emergency_verification_status text DEFAULT 'pending'::text NOT NULL,
    emergency_verified_at timestamp with time zone,
    emergency_verified_by uuid,
    emergency_review_notes text,
    personal_correction_instructions text,
    address_correction_instructions text,
    bank_correction_instructions text,
    identity_correction_instructions text,
    education_correction_instructions text,
    emergency_correction_instructions text,
    employment_correction_instructions text,
    CONSTRAINT joining_onboarding_address_verification_check CHECK ((address_verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'correction_required'::text]))),
    CONSTRAINT joining_onboarding_bank_verification_check CHECK ((bank_verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'correction_required'::text]))),
    CONSTRAINT joining_onboarding_education_verification_check CHECK ((education_verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'correction_required'::text]))),
    CONSTRAINT joining_onboarding_emergency_verification_check CHECK ((emergency_verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'correction_required'::text]))),
    CONSTRAINT joining_onboarding_identity_verification_check CHECK ((identity_verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'correction_required'::text]))),
    CONSTRAINT joining_onboarding_personal_verification_check CHECK ((personal_verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'correction_required'::text]))),
    CONSTRAINT joining_onboarding_submissions_employment_verification_status_c CHECK ((employment_verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'correction_required'::text]))),
    CONSTRAINT joining_onboarding_submissions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'correction_required'::text, 'verified'::text, 'superseded'::text]))),
    CONSTRAINT joining_onboarding_submissions_submission_data_check CHECK ((jsonb_typeof(submission_data) = 'object'::text)),
    CONSTRAINT joining_onboarding_submissions_version_check CHECK ((version > 0))
);


--
-- Name: joining_onboarding_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.joining_onboarding_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    submission_id uuid
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
    leave_duration text,
    leave_duration_unit text,
    supporting_document_url text,
    manager_reviewed_by uuid,
    manager_reviewed_at timestamp with time zone,
    manager_rejection_reason text,
    CONSTRAINT leave_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'pending_manager'::text, 'pending_hr'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text, 'expired'::text])))
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
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'general'::text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    recipient_user_id uuid,
    event_id uuid
);


--
-- Name: payroll_configuration_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_configuration_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope_type text NOT NULL,
    scope_id uuid,
    version_number integer NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    status text DEFAULT 'draft'::text NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    published_by uuid,
    published_at timestamp with time zone,
    CONSTRAINT payroll_configuration_dates_check CHECK (((effective_to IS NULL) OR (effective_to >= effective_from))),
    CONSTRAINT payroll_configuration_scope_check CHECK ((((scope_type = 'global'::text) AND (scope_id IS NULL)) OR ((scope_type <> 'global'::text) AND (scope_id IS NOT NULL)))),
    CONSTRAINT payroll_configuration_versions_scope_type_check CHECK ((scope_type = ANY (ARRAY['global'::text, 'department'::text, 'team'::text, 'employee'::text]))),
    CONSTRAINT payroll_configuration_versions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]))),
    CONSTRAINT payroll_configuration_versions_version_number_check CHECK ((version_number > 0))
);


--
-- Name: payroll_formula_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_formula_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope_type text NOT NULL,
    scope_id uuid,
    component_code text NOT NULL,
    calculation_type text NOT NULL,
    value numeric(14,4) DEFAULT 0 NOT NULL,
    formula_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    configuration_version_id uuid,
    CONSTRAINT payroll_formula_effective_dates_check CHECK (((effective_to IS NULL) OR (effective_to >= effective_from))),
    CONSTRAINT payroll_formula_rules_scope_type_check CHECK ((scope_type = ANY (ARRAY['global'::text, 'department'::text, 'team'::text, 'employee'::text]))),
    CONSTRAINT payroll_formula_scope_id_check CHECK ((((scope_type = 'global'::text) AND (scope_id IS NULL)) OR ((scope_type <> 'global'::text) AND (scope_id IS NOT NULL))))
);


--
-- Name: payroll_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payroll_month integer NOT NULL,
    payroll_year integer NOT NULL,
    run_number integer DEFAULT 1 NOT NULL,
    run_type text DEFAULT 'regular'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    employee_count integer DEFAULT 0 NOT NULL,
    reason text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT payroll_runs_payroll_month_check CHECK (((payroll_month >= 1) AND (payroll_month <= 12))),
    CONSTRAINT payroll_runs_payroll_year_check CHECK (((payroll_year >= 2000) AND (payroll_year <= 2200))),
    CONSTRAINT payroll_runs_run_type_check CHECK ((run_type = ANY (ARRAY['regular'::text, 'regeneration'::text, 'final_settlement'::text]))),
    CONSTRAINT payroll_runs_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: payroll_statutory_recoveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_statutory_recoveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    deduction_code text NOT NULL,
    source_payroll_run_id uuid,
    source_payslip_id uuid,
    payroll_month integer NOT NULL,
    payroll_year integer NOT NULL,
    company_paid_amount numeric(12,2) NOT NULL,
    approved_recovery_amount numeric(12,2) DEFAULT 0 NOT NULL,
    recovered_amount numeric(12,2) DEFAULT 0 NOT NULL,
    outstanding_amount numeric(12,2) NOT NULL,
    status text DEFAULT 'pending_approval'::text NOT NULL,
    approval_note text,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payroll_statutory_recoveries_approved_recovery_amount_check CHECK ((approved_recovery_amount >= (0)::numeric)),
    CONSTRAINT payroll_statutory_recoveries_company_paid_amount_check CHECK ((company_paid_amount > (0)::numeric)),
    CONSTRAINT payroll_statutory_recoveries_deduction_code_check CHECK ((deduction_code = ANY (ARRAY['PF'::text, 'ESI'::text]))),
    CONSTRAINT payroll_statutory_recoveries_payroll_month_check CHECK (((payroll_month >= 1) AND (payroll_month <= 12))),
    CONSTRAINT payroll_statutory_recoveries_recovered_amount_check CHECK ((recovered_amount >= (0)::numeric)),
    CONSTRAINT payroll_statutory_recoveries_status_check CHECK ((status = ANY (ARRAY['pending_approval'::text, 'approved'::text, 'rejected'::text, 'partially_recovered'::text, 'recovered'::text, 'cancelled'::text]))),
    CONSTRAINT payroll_statutory_recovery_amounts_check CHECK (((approved_recovery_amount <= company_paid_amount) AND (recovered_amount <= approved_recovery_amount) AND (outstanding_amount = (company_paid_amount - recovered_amount))))
);


--
-- Name: payroll_statutory_recovery_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_statutory_recovery_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recovery_id uuid NOT NULL,
    payroll_run_id uuid,
    payslip_id uuid,
    payroll_month integer NOT NULL,
    payroll_year integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    recorded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payroll_statutory_recovery_transactions_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT payroll_statutory_recovery_transactions_payroll_month_check CHECK (((payroll_month >= 1) AND (payroll_month <= 12)))
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
    pf_eligible_amount numeric(12,2) DEFAULT 0 NOT NULL,
    pf_deducted_amount numeric(12,2) DEFAULT 0 NOT NULL,
    pf_pending_amount numeric(12,2) DEFAULT 0 NOT NULL,
    esi_eligible_amount numeric(12,2) DEFAULT 0 NOT NULL,
    esi_deducted_amount numeric(12,2) DEFAULT 0 NOT NULL,
    esi_pending_amount numeric(12,2) DEFAULT 0 NOT NULL,
    employer_esi numeric(12,2) DEFAULT 0 NOT NULL,
    pf_admin numeric(12,2) DEFAULT 0 NOT NULL,
    version_number integer DEFAULT 1 NOT NULL,
    is_current boolean DEFAULT true NOT NULL,
    payroll_run_id uuid,
    calculation_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    generated_by uuid,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    approval_status text DEFAULT 'pending'::text NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    payment_reference text,
    paid_at timestamp with time zone,
    is_final_payroll boolean DEFAULT false NOT NULL,
    CONSTRAINT payslips_approval_status_check CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT payslips_payment_status_check CHECK ((payment_status = ANY (ARRAY['draft'::text, 'processed'::text, 'paid'::text])))
);


--
-- Name: policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    category text DEFAULT 'General'::text NOT NULL,
    description text,
    document_url text,
    effective_date date,
    status text DEFAULT 'Draft'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cloudinary_public_id text,
    cloudinary_resource_type text DEFAULT 'raw'::text NOT NULL,
    document_name text,
    document_content_type text,
    CONSTRAINT policies_status_check CHECK ((status = ANY (ARRAY['Draft'::text, 'Active'::text, 'Inactive'::text])))
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
    must_change_password boolean DEFAULT false NOT NULL,
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
    created_at timestamp with time zone DEFAULT now(),
    created_by_employee_id uuid
);


--
-- Name: resignation_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resignation_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    resignation_date date NOT NULL,
    notice_period_days integer,
    planned_last_working_date date,
    reason text NOT NULL,
    document_url text NOT NULL,
    document_name text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    rejection_reason text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    submitted_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    previous_employee_state jsonb,
    CONSTRAINT resignation_dates_valid CHECK ((planned_last_working_date >= resignation_date)),
    CONSTRAINT resignation_requests_notice_period_days_check CHECK (((notice_period_days >= 1) AND (notice_period_days <= 365))),
    CONSTRAINT resignation_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'withdrawn'::text, 'reverted'::text])))
);


--
-- Name: resignation_revert_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resignation_revert_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resignation_request_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    requested_by uuid NOT NULL,
    reason text,
    status text DEFAULT 'pending'::text NOT NULL,
    rejection_reason text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT resignation_revert_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
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
    CONSTRAINT salary_components_calculation_type_check CHECK ((calculation_type = ANY (ARRAY['fixed'::text, 'percentage_of_basic'::text, 'percentage_of_gross'::text, 'percentage_of_ctc'::text, 'balance_of_ctc'::text]))),
    CONSTRAINT salary_components_type_check CHECK ((type = ANY (ARRAY['earning'::text, 'deduction'::text, 'employer_contribution'::text])))
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    department_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wfh_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wfh_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    request_date date NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    rejection_reason text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT wfh_requests_status_check CHECK ((status = ANY (ARRAY['pending_manager'::text, 'pending'::text, 'approved'::text, 'rejected'::text])))
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
-- Name: attendance_settings attendance_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_settings
    ADD CONSTRAINT attendance_settings_pkey PRIMARY KEY (setting_key);


--
-- Name: company_event_departments company_event_departments_event_id_department_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_event_departments
    ADD CONSTRAINT company_event_departments_event_id_department_id_key UNIQUE (event_id, department_id);


--
-- Name: company_event_departments company_event_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_event_departments
    ADD CONSTRAINT company_event_departments_pkey PRIMARY KEY (id);


--
-- Name: company_event_employees company_event_employees_event_id_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_event_employees
    ADD CONSTRAINT company_event_employees_event_id_employee_id_key UNIQUE (event_id, employee_id);


--
-- Name: company_event_employees company_event_employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_event_employees
    ADD CONSTRAINT company_event_employees_pkey PRIMARY KEY (id);


--
-- Name: company_event_media company_event_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_event_media
    ADD CONSTRAINT company_event_media_pkey PRIMARY KEY (id);


--
-- Name: company_events company_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_events
    ADD CONSTRAINT company_events_pkey PRIMARY KEY (id);


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
-- Name: employee_education employee_education_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_education
    ADD CONSTRAINT employee_education_pkey PRIMARY KEY (id);


--
-- Name: employee_education employee_education_source_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_education
    ADD CONSTRAINT employee_education_source_unique UNIQUE (employee_id, source_submission_id, source_qualification_key);


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
-- Name: employee_previous_employment employee_previous_employment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_previous_employment
    ADD CONSTRAINT employee_previous_employment_pkey PRIMARY KEY (id);


--
-- Name: employee_previous_employment employee_previous_employment_source_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_previous_employment
    ADD CONSTRAINT employee_previous_employment_source_unique UNIQUE (employee_id, source_submission_id, source_employment_record_id);


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
-- Name: joining_action_tokens joining_action_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_action_tokens
    ADD CONSTRAINT joining_action_tokens_pkey PRIMARY KEY (id);


--
-- Name: joining_action_tokens joining_action_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_action_tokens
    ADD CONSTRAINT joining_action_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: joining_candidates joining_candidates_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_candidates
    ADD CONSTRAINT joining_candidates_employee_id_key UNIQUE (employee_id);


--
-- Name: joining_candidates joining_candidates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_candidates
    ADD CONSTRAINT joining_candidates_pkey PRIMARY KEY (id);


--
-- Name: joining_date_history joining_date_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_date_history
    ADD CONSTRAINT joining_date_history_pkey PRIMARY KEY (id);


--
-- Name: joining_documents joining_documents_candidate_id_document_type_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_documents
    ADD CONSTRAINT joining_documents_candidate_id_document_type_version_key UNIQUE (candidate_id, document_type, version);


--
-- Name: joining_documents joining_documents_id_candidate_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_documents
    ADD CONSTRAINT joining_documents_id_candidate_unique UNIQUE (id, candidate_id);


--
-- Name: joining_documents joining_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_documents
    ADD CONSTRAINT joining_documents_pkey PRIMARY KEY (id);


--
-- Name: joining_notifications joining_notifications_candidate_id_reminder_type_scheduled__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_notifications
    ADD CONSTRAINT joining_notifications_candidate_id_reminder_type_scheduled__key UNIQUE (candidate_id, reminder_type, scheduled_for);


--
-- Name: joining_notifications joining_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_notifications
    ADD CONSTRAINT joining_notifications_pkey PRIMARY KEY (id);


--
-- Name: joining_onboarding_documents joining_onboarding_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_onboarding_documents
    ADD CONSTRAINT joining_onboarding_documents_pkey PRIMARY KEY (id);


--
-- Name: joining_onboarding_documents joining_onboarding_documents_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_onboarding_documents
    ADD CONSTRAINT joining_onboarding_documents_storage_path_key UNIQUE (storage_path);


--
-- Name: joining_onboarding_events joining_onboarding_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_onboarding_events
    ADD CONSTRAINT joining_onboarding_events_pkey PRIMARY KEY (id);


--
-- Name: joining_onboarding_link_locks joining_onboarding_link_locks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_onboarding_link_locks
    ADD CONSTRAINT joining_onboarding_link_locks_pkey PRIMARY KEY (candidate_id);


--
-- Name: joining_onboarding_submissions joining_onboarding_submission_id_candidate_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_onboarding_submissions
    ADD CONSTRAINT joining_onboarding_submission_id_candidate_unique UNIQUE (id, candidate_id);


--
-- Name: joining_onboarding_submissions joining_onboarding_submission_version_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_onboarding_submissions
    ADD CONSTRAINT joining_onboarding_submission_version_unique UNIQUE (candidate_id, version);


--
-- Name: joining_onboarding_submissions joining_onboarding_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_onboarding_submissions
    ADD CONSTRAINT joining_onboarding_submissions_pkey PRIMARY KEY (id);


--
-- Name: joining_onboarding_tokens joining_onboarding_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_onboarding_tokens
    ADD CONSTRAINT joining_onboarding_tokens_pkey PRIMARY KEY (id);


--
-- Name: joining_onboarding_tokens joining_onboarding_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_onboarding_tokens
    ADD CONSTRAINT joining_onboarding_tokens_token_hash_key UNIQUE (token_hash);


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
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: payroll_configuration_versions payroll_configuration_version_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_configuration_versions
    ADD CONSTRAINT payroll_configuration_version_unique UNIQUE (scope_type, scope_id, version_number);


--
-- Name: payroll_configuration_versions payroll_configuration_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_configuration_versions
    ADD CONSTRAINT payroll_configuration_versions_pkey PRIMARY KEY (id);


--
-- Name: payroll_formula_rules payroll_formula_no_active_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_formula_rules
    ADD CONSTRAINT payroll_formula_no_active_overlap EXCLUDE USING gist (scope_type WITH =, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =, component_code WITH =, daterange(effective_from, effective_to, '[]'::text) WITH &&) WHERE (is_active);


--
-- Name: payroll_formula_rules payroll_formula_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_formula_rules
    ADD CONSTRAINT payroll_formula_rules_pkey PRIMARY KEY (id);


--
-- Name: payroll_runs payroll_runs_payroll_month_payroll_year_run_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_runs
    ADD CONSTRAINT payroll_runs_payroll_month_payroll_year_run_number_key UNIQUE (payroll_month, payroll_year, run_number);


--
-- Name: payroll_runs payroll_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_runs
    ADD CONSTRAINT payroll_runs_pkey PRIMARY KEY (id);


--
-- Name: payroll_statutory_recoveries payroll_statutory_recoveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_statutory_recoveries
    ADD CONSTRAINT payroll_statutory_recoveries_pkey PRIMARY KEY (id);


--
-- Name: payroll_statutory_recovery_transactions payroll_statutory_recovery_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_statutory_recovery_transactions
    ADD CONSTRAINT payroll_statutory_recovery_transactions_pkey PRIMARY KEY (id);


--
-- Name: payslips payslips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_pkey PRIMARY KEY (id);


--
-- Name: policies policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policies
    ADD CONSTRAINT policies_pkey PRIMARY KEY (id);


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
-- Name: resignation_requests resignation_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resignation_requests
    ADD CONSTRAINT resignation_requests_pkey PRIMARY KEY (id);


--
-- Name: resignation_revert_requests resignation_revert_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resignation_revert_requests
    ADD CONSTRAINT resignation_revert_requests_pkey PRIMARY KEY (id);


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
-- Name: teams teams_department_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_department_name_unique UNIQUE (department_id, name);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: wfh_requests wfh_requests_employee_date_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wfh_requests
    ADD CONSTRAINT wfh_requests_employee_date_unique UNIQUE (employee_id, request_date);


--
-- Name: wfh_requests wfh_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wfh_requests
    ADD CONSTRAINT wfh_requests_pkey PRIMARY KEY (id);


--
-- Name: attendance_settings_employee_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX attendance_settings_employee_unique ON public.attendance_settings USING btree (employee_id) WHERE (employee_id IS NOT NULL);


--
-- Name: employee_documents_employee_type_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employee_documents_employee_type_status_idx ON public.employee_documents USING btree (employee_id, document_type, verification_status);


--
-- Name: employee_documents_source_joining_document_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employee_documents_source_joining_document_id_unique ON public.employee_documents USING btree (source_joining_document_id) WHERE (source_joining_document_id IS NOT NULL);


--
-- Name: employee_documents_source_onboarding_document_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employee_documents_source_onboarding_document_unique ON public.employee_documents USING btree (source_onboarding_document_id) WHERE (source_onboarding_document_id IS NOT NULL);


--
-- Name: employee_education_employee_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employee_education_employee_idx ON public.employee_education USING btree (employee_id);


--
-- Name: employee_one_document_type; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employee_one_document_type ON public.employee_documents USING btree (employee_id, document_type) WHERE ((verification_status = 'approved'::text) AND (document_type <> ALL (ARRAY['Experience Letter'::text, 'Other'::text])) AND (source_onboarding_document_id IS NULL));


--
-- Name: employee_one_pending_document_type; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employee_one_pending_document_type ON public.employee_documents USING btree (employee_id, document_type) WHERE ((verification_status = 'pending'::text) AND (document_type <> ALL (ARRAY['Experience Letter'::text, 'Other'::text])) AND (source_onboarding_document_id IS NULL));


--
-- Name: employee_previous_employment_employee_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employee_previous_employment_employee_idx ON public.employee_previous_employment USING btree (employee_id);


--
-- Name: employees_user_id_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employees_user_id_unique_idx ON public.employees USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: holiday_calendars_country_shift_year_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX holiday_calendars_country_shift_year_uidx ON public.holiday_calendars USING btree (country_code, shift_type, calendar_year);


--
-- Name: holidays_emergency_company_date_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX holidays_emergency_company_date_unique ON public.holidays USING btree (holiday_date) WHERE ((holiday_type = 'emergency'::text) AND (scope = 'company'::text));


--
-- Name: holidays_emergency_date_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX holidays_emergency_date_status_idx ON public.holidays USING btree (holiday_date, status) WHERE (holiday_type = 'emergency'::text);


--
-- Name: holidays_emergency_project_date_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX holidays_emergency_project_date_unique ON public.holidays USING btree (project_id, holiday_date) WHERE ((holiday_type = 'emergency'::text) AND (scope = 'project'::text));


--
-- Name: idx_company_events_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_events_expiry ON public.company_events USING btree (expires_at);


--
-- Name: idx_company_events_status_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_events_status_date ON public.company_events USING btree (status, event_date);


--
-- Name: idx_company_events_type_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_events_type_status ON public.company_events USING btree (event_type, status);


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
-- Name: idx_employees_reporting_manager_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_reporting_manager_id ON public.employees USING btree (reporting_manager_id);


--
-- Name: idx_employees_retained_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_retained_project_id ON public.employees USING btree (retained_project_id);


--
-- Name: idx_employees_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_team_id ON public.employees USING btree (team_id);


--
-- Name: idx_event_departments_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_departments_department ON public.company_event_departments USING btree (department_id);


--
-- Name: idx_event_departments_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_departments_event ON public.company_event_departments USING btree (event_id);


--
-- Name: idx_event_employees_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_employees_employee ON public.company_event_employees USING btree (employee_id);


--
-- Name: idx_event_employees_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_employees_event ON public.company_event_employees USING btree (event_id);


--
-- Name: idx_event_media_event_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_media_event_order ON public.company_event_media USING btree (event_id, sort_order);


--
-- Name: idx_joining_candidates_add_employee_queue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_joining_candidates_add_employee_queue ON public.joining_candidates USING btree (add_employee_moved_at, created_at DESC) WHERE (add_employee_moved_at IS NOT NULL);


--
-- Name: idx_notifications_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_employee ON public.notifications USING btree (employee_id, created_at DESC);


--
-- Name: idx_notifications_employee_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_employee_created ON public.notifications USING btree (employee_id, created_at DESC);


--
-- Name: idx_notifications_employee_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_employee_unread ON public.notifications USING btree (employee_id, is_read) WHERE (is_read = false);


--
-- Name: idx_notifications_recipient_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_recipient_user ON public.notifications USING btree (recipient_user_id, created_at DESC);


--
-- Name: idx_one_pending_revert_per_resignation; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_one_pending_revert_per_resignation ON public.resignation_revert_requests USING btree (resignation_request_id) WHERE (status = 'pending'::text);


--
-- Name: idx_payroll_configuration_scope_effective; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_configuration_scope_effective ON public.payroll_configuration_versions USING btree (scope_type, scope_id, effective_from, effective_to);


--
-- Name: idx_payroll_formula_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_formula_active ON public.payroll_formula_rules USING btree (is_active, effective_from);


--
-- Name: idx_payroll_formula_configuration_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_formula_configuration_version ON public.payroll_formula_rules USING btree (configuration_version_id);


--
-- Name: idx_payroll_formula_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_formula_lookup ON public.payroll_formula_rules USING btree (scope_type, scope_id, component_code, effective_from);


--
-- Name: idx_payroll_runs_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_runs_period ON public.payroll_runs USING btree (payroll_year, payroll_month, created_at DESC);


--
-- Name: idx_payroll_statutory_recoveries_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_statutory_recoveries_employee ON public.payroll_statutory_recoveries USING btree (employee_id, status);


--
-- Name: idx_payroll_statutory_recoveries_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_statutory_recoveries_period ON public.payroll_statutory_recoveries USING btree (payroll_year, payroll_month);


--
-- Name: idx_payroll_statutory_recovery_transactions_recovery; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_statutory_recovery_transactions_recovery ON public.payroll_statutory_recovery_transactions USING btree (recovery_id);


--
-- Name: idx_payslips_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payslips_run ON public.payslips USING btree (payroll_run_id);


--
-- Name: idx_policies_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policies_category ON public.policies USING btree (category);


--
-- Name: idx_policies_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policies_created_at ON public.policies USING btree (created_at DESC);


--
-- Name: idx_policies_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policies_status ON public.policies USING btree (status);


--
-- Name: idx_resignation_revert_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resignation_revert_employee ON public.resignation_revert_requests USING btree (employee_id);


--
-- Name: idx_resignation_revert_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resignation_revert_status ON public.resignation_revert_requests USING btree (status);


--
-- Name: idx_teams_department_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teams_department_id ON public.teams USING btree (department_id);


--
-- Name: joining_action_tokens_candidate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX joining_action_tokens_candidate_idx ON public.joining_action_tokens USING btree (candidate_id);


--
-- Name: joining_action_tokens_document_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX joining_action_tokens_document_id_idx ON public.joining_action_tokens USING btree (document_id);


--
-- Name: joining_candidates_employee_record_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX joining_candidates_employee_record_id_key ON public.joining_candidates USING btree (employee_record_id) WHERE (employee_record_id IS NOT NULL);


--
-- Name: joining_candidates_joining_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX joining_candidates_joining_date_idx ON public.joining_candidates USING btree (joining_date);


--
-- Name: joining_candidates_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX joining_candidates_status_idx ON public.joining_candidates USING btree (status);


--
-- Name: joining_date_history_candidate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX joining_date_history_candidate_idx ON public.joining_date_history USING btree (candidate_id, changed_at DESC);


--
-- Name: joining_documents_candidate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX joining_documents_candidate_idx ON public.joining_documents USING btree (candidate_id);


--
-- Name: joining_notifications_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX joining_notifications_pending_idx ON public.joining_notifications USING btree (status, scheduled_for);


--
-- Name: joining_onboarding_document_employment_version_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX joining_onboarding_document_employment_version_unique ON public.joining_onboarding_documents USING btree (candidate_id, employment_record_id, document_type, version) WHERE (employment_record_id IS NOT NULL);


--
-- Name: joining_onboarding_document_version_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX joining_onboarding_document_version_unique ON public.joining_onboarding_documents USING btree (candidate_id, document_type, version) WHERE (employment_record_id IS NULL);


--
-- Name: joining_onboarding_documents_candidate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX joining_onboarding_documents_candidate_idx ON public.joining_onboarding_documents USING btree (candidate_id);


--
-- Name: joining_onboarding_documents_employment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX joining_onboarding_documents_employment_idx ON public.joining_onboarding_documents USING btree (candidate_id, submission_id, employment_record_id) WHERE (employment_record_id IS NOT NULL);


--
-- Name: joining_onboarding_documents_review_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX joining_onboarding_documents_review_idx ON public.joining_onboarding_documents USING btree (verification_status);


--
-- Name: joining_onboarding_documents_submission_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX joining_onboarding_documents_submission_idx ON public.joining_onboarding_documents USING btree (submission_id);


--
-- Name: joining_onboarding_events_candidate_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX joining_onboarding_events_candidate_created_idx ON public.joining_onboarding_events USING btree (candidate_id, created_at DESC);


--
-- Name: joining_onboarding_events_submission_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX joining_onboarding_events_submission_idx ON public.joining_onboarding_events USING btree (submission_id);


--
-- Name: joining_onboarding_one_active_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX joining_onboarding_one_active_token_idx ON public.joining_onboarding_tokens USING btree (candidate_id) WHERE ((used_at IS NULL) AND (revoked_at IS NULL));


--
-- Name: joining_onboarding_submissions_candidate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX joining_onboarding_submissions_candidate_idx ON public.joining_onboarding_submissions USING btree (candidate_id);


--
-- Name: joining_onboarding_submissions_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX joining_onboarding_submissions_status_idx ON public.joining_onboarding_submissions USING btree (status);


--
-- Name: joining_onboarding_tokens_candidate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX joining_onboarding_tokens_candidate_idx ON public.joining_onboarding_tokens USING btree (candidate_id);


--
-- Name: joining_onboarding_tokens_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX joining_onboarding_tokens_expiry_idx ON public.joining_onboarding_tokens USING btree (expires_at);


--
-- Name: payslips_one_current_version; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payslips_one_current_version ON public.payslips USING btree (employee_id, payroll_month, payroll_year) WHERE (is_current = true);


--
-- Name: resignation_requests_one_pending_per_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX resignation_requests_one_pending_per_employee ON public.resignation_requests USING btree (employee_id) WHERE (status = 'pending'::text);


--
-- Name: resignation_requests_status_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX resignation_requests_status_created_idx ON public.resignation_requests USING btree (status, created_at DESC);


--
-- Name: uq_payroll_statutory_recovery_source; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_payroll_statutory_recovery_source ON public.payroll_statutory_recoveries USING btree (employee_id, deduction_code, payroll_year, payroll_month, source_payroll_run_id);


--
-- Name: joining_candidates trg_guard_accepted_offer_reference; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_guard_accepted_offer_reference BEFORE UPDATE OF accepted_offer_document_id ON public.joining_candidates FOR EACH ROW EXECUTE FUNCTION public.guard_accepted_offer_reference();


--
-- Name: joining_candidates trg_guard_joining_letter_hr_verification; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_guard_joining_letter_hr_verification BEFORE UPDATE OF joining_letter_send_status ON public.joining_candidates FOR EACH ROW EXECUTE FUNCTION public.guard_joining_letter_hr_verification();


--
-- Name: joining_documents trg_guard_joining_offer_document; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_guard_joining_offer_document BEFORE DELETE OR UPDATE ON public.joining_documents FOR EACH ROW EXECUTE FUNCTION public.guard_joining_offer_document();


--
-- Name: leave_requests trg_prevent_leave_request_overlap_v2; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_leave_request_overlap_v2 BEFORE INSERT OR UPDATE OF employee_id, start_date, end_date, status ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.prevent_leave_request_overlap_v2();


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
-- Name: attendance_logs attendance_logs_hr_decision_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_logs
    ADD CONSTRAINT attendance_logs_hr_decision_by_fkey FOREIGN KEY (hr_decision_by) REFERENCES public.profiles(id);


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
-- Name: attendance_settings attendance_settings_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_settings
    ADD CONSTRAINT attendance_settings_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: attendance_settings attendance_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_settings
    ADD CONSTRAINT attendance_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: company_event_departments company_event_departments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_event_departments
    ADD CONSTRAINT company_event_departments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: company_event_departments company_event_departments_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_event_departments
    ADD CONSTRAINT company_event_departments_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.company_events(id) ON DELETE CASCADE;


--
-- Name: company_event_employees company_event_employees_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_event_employees
    ADD CONSTRAINT company_event_employees_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: company_event_employees company_event_employees_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_event_employees
    ADD CONSTRAINT company_event_employees_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.company_events(id) ON DELETE CASCADE;


--
-- Name: company_event_media company_event_media_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_event_media
    ADD CONSTRAINT company_event_media_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.company_events(id) ON DELETE CASCADE;


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
-- Name: employee_documents employee_documents_source_joining_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_source_joining_document_id_fkey FOREIGN KEY (source_joining_document_id) REFERENCES public.joining_documents(id);


--
-- Name: employee_documents employee_documents_source_onboarding_document_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_source_onboarding_document_fkey FOREIGN KEY (source_onboarding_document_id) REFERENCES public.joining_onboarding_documents(id);


--
-- Name: employee_documents employee_documents_source_onboarding_submission_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_source_onboarding_submission_fkey FOREIGN KEY (source_onboarding_submission_id) REFERENCES public.joining_onboarding_submissions(id);


--
-- Name: employee_education employee_education_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_education
    ADD CONSTRAINT employee_education_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_education employee_education_source_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_education
    ADD CONSTRAINT employee_education_source_submission_id_fkey FOREIGN KEY (source_submission_id) REFERENCES public.joining_onboarding_submissions(id);


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
-- Name: employee_previous_employment employee_previous_employment_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_previous_employment
    ADD CONSTRAINT employee_previous_employment_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_previous_employment employee_previous_employment_source_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_previous_employment
    ADD CONSTRAINT employee_previous_employment_source_submission_id_fkey FOREIGN KEY (source_submission_id) REFERENCES public.joining_onboarding_submissions(id);


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
-- Name: employees employees_reporting_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_reporting_manager_id_fkey FOREIGN KEY (reporting_manager_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: employees employees_retained_calendar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_retained_calendar_id_fkey FOREIGN KEY (retained_calendar_id) REFERENCES public.holiday_calendars(id) ON DELETE SET NULL;


--
-- Name: employees employees_retained_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_retained_project_id_fkey FOREIGN KEY (retained_project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: employees employees_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


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
-- Name: holidays holidays_cancelled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: holidays holidays_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: holidays holidays_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: joining_action_tokens joining_action_tokens_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_action_tokens
    ADD CONSTRAINT joining_action_tokens_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.joining_candidates(id);


--
-- Name: joining_action_tokens joining_action_tokens_document_candidate_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_action_tokens
    ADD CONSTRAINT joining_action_tokens_document_candidate_fkey FOREIGN KEY (document_id, candidate_id) REFERENCES public.joining_documents(id, candidate_id);


--
-- Name: joining_candidates joining_candidates_accepted_offer_document_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_candidates
    ADD CONSTRAINT joining_candidates_accepted_offer_document_fkey FOREIGN KEY (accepted_offer_document_id, id) REFERENCES public.joining_documents(id, candidate_id);


--
-- Name: joining_candidates joining_candidates_add_employee_moved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_candidates
    ADD CONSTRAINT joining_candidates_add_employee_moved_by_fkey FOREIGN KEY (add_employee_moved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: joining_candidates joining_candidates_current_onboarding_submission_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_candidates
    ADD CONSTRAINT joining_candidates_current_onboarding_submission_fk FOREIGN KEY (onboarding_submission_id, id) REFERENCES public.joining_onboarding_submissions(id, candidate_id) ON DELETE RESTRICT;


--
-- Name: joining_candidates joining_candidates_employee_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_candidates
    ADD CONSTRAINT joining_candidates_employee_record_id_fkey FOREIGN KEY (employee_record_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: joining_candidates joining_candidates_onboarding_verification_reopened_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_candidates
    ADD CONSTRAINT joining_candidates_onboarding_verification_reopened_by_fkey FOREIGN KEY (onboarding_verification_reopened_by) REFERENCES public.profiles(id);


--
-- Name: joining_date_history joining_date_history_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_date_history
    ADD CONSTRAINT joining_date_history_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.joining_candidates(id);


--
-- Name: joining_documents joining_documents_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_documents
    ADD CONSTRAINT joining_documents_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.joining_candidates(id);


--
-- Name: joining_notifications joining_notifications_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_notifications
    ADD CONSTRAINT joining_notifications_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.joining_candidates(id);


--
-- Name: joining_onboarding_documents joining_onboarding_document_submission_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_onboarding_documents
    ADD CONSTRAINT joining_onboarding_document_submission_fkey FOREIGN KEY (submission_id, candidate_id) REFERENCES public.joining_onboarding_submissions(id, candidate_id);


--
-- Name: joining_onboarding_documents joining_onboarding_documents_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_onboarding_documents
    ADD CONSTRAINT joining_onboarding_documents_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.joining_candidates(id);


--
-- Name: joining_onboarding_events joining_onboarding_events_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_onboarding_events
    ADD CONSTRAINT joining_onboarding_events_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.joining_candidates(id);


--
-- Name: joining_onboarding_events joining_onboarding_events_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_onboarding_events
    ADD CONSTRAINT joining_onboarding_events_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.joining_onboarding_submissions(id);


--
-- Name: joining_onboarding_link_locks joining_onboarding_link_locks_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_onboarding_link_locks
    ADD CONSTRAINT joining_onboarding_link_locks_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.joining_candidates(id) ON DELETE CASCADE;


--
-- Name: joining_onboarding_submissions joining_onboarding_submissions_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_onboarding_submissions
    ADD CONSTRAINT joining_onboarding_submissions_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.joining_candidates(id);


--
-- Name: joining_onboarding_submissions joining_onboarding_submissions_supersedes_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_onboarding_submissions
    ADD CONSTRAINT joining_onboarding_submissions_supersedes_submission_id_fkey FOREIGN KEY (supersedes_submission_id) REFERENCES public.joining_onboarding_submissions(id);


--
-- Name: joining_onboarding_tokens joining_onboarding_tokens_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_onboarding_tokens
    ADD CONSTRAINT joining_onboarding_tokens_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.joining_candidates(id);


--
-- Name: joining_onboarding_tokens joining_onboarding_tokens_submission_candidate_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.joining_onboarding_tokens
    ADD CONSTRAINT joining_onboarding_tokens_submission_candidate_fkey FOREIGN KEY (submission_id, candidate_id) REFERENCES public.joining_onboarding_submissions(id, candidate_id);


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
-- Name: leave_requests leave_requests_manager_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_manager_reviewed_by_fkey FOREIGN KEY (manager_reviewed_by) REFERENCES public.profiles(id);


--
-- Name: leave_requests leave_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);


--
-- Name: notifications notifications_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.company_events(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_recipient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: payroll_configuration_versions payroll_configuration_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_configuration_versions
    ADD CONSTRAINT payroll_configuration_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: payroll_configuration_versions payroll_configuration_versions_published_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_configuration_versions
    ADD CONSTRAINT payroll_configuration_versions_published_by_fkey FOREIGN KEY (published_by) REFERENCES auth.users(id);


--
-- Name: payroll_formula_rules payroll_formula_configuration_version_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_formula_rules
    ADD CONSTRAINT payroll_formula_configuration_version_fk FOREIGN KEY (configuration_version_id) REFERENCES public.payroll_configuration_versions(id) ON DELETE RESTRICT;


--
-- Name: payroll_formula_rules payroll_formula_rules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_formula_rules
    ADD CONSTRAINT payroll_formula_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: payroll_statutory_recoveries payroll_statutory_recoveries_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_statutory_recoveries
    ADD CONSTRAINT payroll_statutory_recoveries_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: payroll_statutory_recoveries payroll_statutory_recoveries_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_statutory_recoveries
    ADD CONSTRAINT payroll_statutory_recoveries_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: payroll_statutory_recoveries payroll_statutory_recoveries_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_statutory_recoveries
    ADD CONSTRAINT payroll_statutory_recoveries_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: payroll_statutory_recoveries payroll_statutory_recoveries_source_payroll_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_statutory_recoveries
    ADD CONSTRAINT payroll_statutory_recoveries_source_payroll_run_id_fkey FOREIGN KEY (source_payroll_run_id) REFERENCES public.payroll_runs(id) ON DELETE SET NULL;


--
-- Name: payroll_statutory_recoveries payroll_statutory_recoveries_source_payslip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_statutory_recoveries
    ADD CONSTRAINT payroll_statutory_recoveries_source_payslip_id_fkey FOREIGN KEY (source_payslip_id) REFERENCES public.payslips(id) ON DELETE SET NULL;


--
-- Name: payroll_statutory_recovery_transactions payroll_statutory_recovery_transactions_payroll_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_statutory_recovery_transactions
    ADD CONSTRAINT payroll_statutory_recovery_transactions_payroll_run_id_fkey FOREIGN KEY (payroll_run_id) REFERENCES public.payroll_runs(id) ON DELETE SET NULL;


--
-- Name: payroll_statutory_recovery_transactions payroll_statutory_recovery_transactions_payslip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_statutory_recovery_transactions
    ADD CONSTRAINT payroll_statutory_recovery_transactions_payslip_id_fkey FOREIGN KEY (payslip_id) REFERENCES public.payslips(id) ON DELETE SET NULL;


--
-- Name: payroll_statutory_recovery_transactions payroll_statutory_recovery_transactions_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_statutory_recovery_transactions
    ADD CONSTRAINT payroll_statutory_recovery_transactions_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES auth.users(id);


--
-- Name: payroll_statutory_recovery_transactions payroll_statutory_recovery_transactions_recovery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_statutory_recovery_transactions
    ADD CONSTRAINT payroll_statutory_recovery_transactions_recovery_id_fkey FOREIGN KEY (recovery_id) REFERENCES public.payroll_statutory_recoveries(id) ON DELETE RESTRICT;


--
-- Name: payslips payslips_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: payslips payslips_payroll_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_payroll_run_id_fkey FOREIGN KEY (payroll_run_id) REFERENCES public.payroll_runs(id) ON DELETE SET NULL;


--
-- Name: policies policies_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policies
    ADD CONSTRAINT policies_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


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
-- Name: projects projects_created_by_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_created_by_employee_id_fkey FOREIGN KEY (created_by_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: resignation_requests resignation_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resignation_requests
    ADD CONSTRAINT resignation_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: resignation_requests resignation_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resignation_requests
    ADD CONSTRAINT resignation_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: resignation_requests resignation_requests_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resignation_requests
    ADD CONSTRAINT resignation_requests_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: resignation_revert_requests resignation_revert_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resignation_revert_requests
    ADD CONSTRAINT resignation_revert_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: resignation_revert_requests resignation_revert_requests_resignation_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resignation_revert_requests
    ADD CONSTRAINT resignation_revert_requests_resignation_request_id_fkey FOREIGN KEY (resignation_request_id) REFERENCES public.resignation_requests(id) ON DELETE CASCADE;


--
-- Name: teams teams_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE RESTRICT;


--
-- Name: wfh_requests wfh_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wfh_requests
    ADD CONSTRAINT wfh_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: wfh_requests wfh_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wfh_requests
    ADD CONSTRAINT wfh_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);


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
-- Name: teams Authenticated read teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated read teams" ON public.teams FOR SELECT TO authenticated USING (true);


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
-- Name: employee_education Employees can view their own education records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can view their own education records" ON public.employee_education FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employees e
  WHERE ((e.id = employee_education.employee_id) AND (e.user_id = auth.uid())))));


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
-- Name: policies HR and CEO can create policies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "HR and CEO can create policies" ON public.policies FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['hr'::text, 'ceo'::text]))))));


--
-- Name: employee_documents HR and CEO can delete employee documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "HR and CEO can delete employee documents" ON public.employee_documents FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['hr'::text, 'ceo'::text]))))));


--
-- Name: policies HR and CEO can delete policies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "HR and CEO can delete policies" ON public.policies FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
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
-- Name: policies HR and CEO can update policies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "HR and CEO can update policies" ON public.policies FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
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
-- Name: payroll_formula_rules HR and CEO manage payroll formula rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "HR and CEO manage payroll formula rules" ON public.payroll_formula_rules TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['hr'::text, 'ceo'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['hr'::text, 'ceo'::text]))))));


--
-- Name: teams HR and CEO manage teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "HR and CEO manage teams" ON public.teams TO authenticated USING ((EXISTS ( SELECT 1
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
-- Name: policies Users can view permitted policies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view permitted policies" ON public.policies FOR SELECT TO authenticated USING (((status = 'Active'::text) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['hr'::text, 'ceo'::text])))))));


--
-- Name: attendance_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_regularizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance_regularizations ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: company_event_departments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_event_departments ENABLE ROW LEVEL SECURITY;

--
-- Name: company_event_employees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_event_employees ENABLE ROW LEVEL SECURITY;

--
-- Name: company_event_media; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_event_media ENABLE ROW LEVEL SECURITY;

--
-- Name: company_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_events ENABLE ROW LEVEL SECURITY;

--
-- Name: departments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_education; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_education ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_leave_balances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_leave_balances ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_previous_employment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_previous_employment ENABLE ROW LEVEL SECURITY;

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
-- Name: joining_action_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.joining_action_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: joining_candidates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.joining_candidates ENABLE ROW LEVEL SECURITY;

--
-- Name: joining_date_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.joining_date_history ENABLE ROW LEVEL SECURITY;

--
-- Name: joining_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.joining_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: joining_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.joining_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: joining_onboarding_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.joining_onboarding_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: joining_onboarding_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.joining_onboarding_events ENABLE ROW LEVEL SECURITY;

--
-- Name: joining_onboarding_link_locks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.joining_onboarding_link_locks ENABLE ROW LEVEL SECURITY;

--
-- Name: joining_onboarding_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.joining_onboarding_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: joining_onboarding_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.joining_onboarding_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: leave_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: leave_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll_configuration_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payroll_configuration_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll_formula_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payroll_formula_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll_statutory_recoveries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payroll_statutory_recoveries ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll_statutory_recovery_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payroll_statutory_recovery_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: payslips; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

--
-- Name: policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;

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
-- Name: resignation_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resignation_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: resignation_revert_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resignation_revert_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: salary_components; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.salary_components ENABLE ROW LEVEL SECURITY;

--
-- Name: teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

--
-- Name: wfh_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wfh_requests ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict nMZMTqhOd6jfFZ14hA72R1VbzusOf1NjmAODxsjGToK3Fjkmy5C9LMtgm69GmE5

