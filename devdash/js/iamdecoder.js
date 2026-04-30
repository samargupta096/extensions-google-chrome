document.addEventListener('DOMContentLoaded', () => {
  const errorInput = document.getElementById('iam-error-input');
  const decodeBtn = document.getElementById('iam-decode-btn');
  const resultEl = document.getElementById('iam-result');

  if (!decodeBtn) return;

  const patterns = [
    { match: /AccessDenied|AccessDeniedException/i, service: 'IAM', suggestion: 'The calling identity lacks the required permission.', fix: 'Check your IAM role/user policies. Run `aws iam simulate-principal-policy` to test.', action: 'Verify the Action, Resource, and Condition in your policy match the request.' },
    { match: /s3[:\s]*(GetObject|PutObject|ListBucket|DeleteObject)/i, service: 'S3', suggestion: 'Missing S3 bucket or object-level permission.', fix: 'Add the specific s3:Action to your IAM policy. Check both identity-based AND bucket policies.', action: 'Ensure the Resource ARN matches: arn:aws:s3:::bucket-name/* for objects, arn:aws:s3:::bucket-name for bucket-level.' },
    { match: /sts:AssumeRole/i, service: 'STS', suggestion: 'Cannot assume the target IAM role.', fix: 'Check the trust policy on the TARGET role allows the source principal to assume it.', action: 'Update the trust relationship: {"Effect":"Allow","Principal":{"AWS":"arn:aws:iam::SOURCE_ACCOUNT:role/SOURCE_ROLE"},"Action":"sts:AssumeRole"}' },
    { match: /ec2[:\s]*(RunInstances|DescribeInstances|StartInstances|StopInstances)/i, service: 'EC2', suggestion: 'Missing EC2 instance management permission.', fix: 'Add the ec2:Action to your policy. Check for region or tag-based conditions.', action: 'Common fix: Allow ec2:Describe* for read access, ec2:RunInstances for launches.' },
    { match: /lambda[:\s]*(InvokeFunction|CreateFunction|UpdateFunctionCode)/i, service: 'Lambda', suggestion: 'Missing Lambda function permission.', fix: 'Add lambda:InvokeFunction or lambda:UpdateFunctionCode to your policy.', action: 'Also check if the Lambda has a resource-based policy that allows the caller.' },
    { match: /rds|aurora/i, service: 'RDS', suggestion: 'Missing RDS database permission.', fix: 'Add rds:Describe*, rds:CreateDBInstance, or rds:ModifyDBInstance as needed.', action: 'For IAM DB authentication, ensure the DB user is mapped to the IAM role.' },
    { match: /dynamodb[:\s]*(GetItem|PutItem|Query|Scan|DeleteItem)/i, service: 'DynamoDB', suggestion: 'Missing DynamoDB table permission.', fix: 'Add dynamodb:Action to your policy with the correct table ARN.', action: 'Resource format: arn:aws:dynamodb:REGION:ACCOUNT:table/TABLE_NAME' },
    { match: /UnauthorizedAccess|403|Forbidden/i, service: 'General', suggestion: 'The request was authenticated but authorization failed.', fix: 'This is a 403 — you are known but not allowed. Check IAM policies, SCPs, and resource policies.', action: 'Use AWS CloudTrail to find the exact API call and which policy denied it.' },
    { match: /ExpiredToken|TokenExpired|security token.*expired/i, service: 'STS', suggestion: 'Your temporary credentials (session token) have expired.', fix: 'Refresh your credentials with `aws sts get-session-token` or re-assume the role.', action: 'Session tokens default to 1 hour. Use --duration-seconds to extend (max 12h for roles).' },
    { match: /permission.*denied|PERMISSION_DENIED/i, service: 'GCP', suggestion: 'GCP IAM permission denied.', fix: 'Check IAM roles on the project/resource. Use `gcloud projects get-iam-policy PROJECT_ID`.', action: 'Grant the minimum role needed, e.g., roles/storage.objectViewer for GCS read.' }
  ];

  decodeBtn.addEventListener('click', () => {
    const error = errorInput.value.trim();
    if (!error) return;

    let matched = null;
    for (const p of patterns) {
      if (p.match.test(error)) {
        matched = p;
        break;
      }
    }

    if (matched) {
      resultEl.innerHTML = `
        <div class="iam-match">
          <div class="iam-service-badge">${matched.service}</div>
          <div class="iam-suggestion"><strong>Issue:</strong> ${matched.suggestion}</div>
          <div class="iam-fix"><strong>Fix:</strong> ${matched.fix}</div>
          <div class="iam-action"><strong>Action:</strong> ${matched.action}</div>
        </div>
      `;
    } else {
      resultEl.innerHTML = `
        <div class="iam-match">
          <div class="iam-suggestion">Could not match a known IAM error pattern.</div>
          <div class="iam-fix"><strong>General tips:</strong> Check CloudTrail for the denied API call. Use IAM Policy Simulator. Verify SCPs aren't blocking.</div>
        </div>
      `;
    }
    resultEl.style.display = 'block';
  });
});
