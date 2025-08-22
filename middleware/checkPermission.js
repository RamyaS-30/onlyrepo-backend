const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const checkPermission = (requiredRole) => {
  return async (req, res, next) => {
    const userId = req.user.id;
    const { id, type } = req.params;

    const { data: permission, error } = await supabase
      .from('permissions')
      .select('*')
      .eq('user_id', userId)
      .eq('resource_id', id)
      .eq('resource_type', type)
      .single();

    if (error || !permission) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const rolesHierarchy = ['viewer', 'editor', 'owner'];
    if (rolesHierarchy.indexOf(permission.role) < rolesHierarchy.indexOf(requiredRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

module.exports = checkPermission;